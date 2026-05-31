"""Unit tests for the ADR 0008 security hardening layer.

Covered: security headers (presence + HSTS gating on TLS termination),
route-level authz on the read surfaces, request-size ceiling (413), the
deployment-mode helpers, and the deployment-aware secret provider selection.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tessera.settings import DeploymentMode, get_settings


@pytest.fixture
def _client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """A TestClient with no bearer token configured (CI posture)."""
    monkeypatch.delenv("TESSERA_API__BEARER_TOKEN", raising=False)
    get_settings.cache_clear()
    from tessera.api.main import build_app

    return TestClient(build_app())


class TestSecurityHeaders:
    def test_headers_present_on_health(self, _client: TestClient) -> None:
        r = _client.get("/healthz")
        assert r.status_code == 200
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["x-frame-options"] == "DENY"
        assert "content-security-policy" in r.headers
        assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"

    def test_hsts_present_when_tls_terminated(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("TESSERA_API__TLS_TERMINATED", "true")
        get_settings.cache_clear()
        from tessera.api.main import build_app

        client = TestClient(build_app())
        r = client.get("/healthz")
        assert "strict-transport-security" in r.headers

    def test_hsts_absent_when_tls_not_terminated(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("TESSERA_API__TLS_TERMINATED", "false")
        get_settings.cache_clear()
        from tessera.api.main import build_app

        client = TestClient(build_app())
        r = client.get("/healthz")
        assert "strict-transport-security" not in r.headers


class TestRouteAuthz:
    def test_audit_requires_bearer_when_configured(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("TESSERA_API__BEARER_TOKEN", "s3cret-token")
        get_settings.cache_clear()
        from tessera.api.main import build_app

        client = TestClient(build_app())
        # Missing token → 401.
        assert client.get("/audit").status_code == 401
        # Wrong token → 401.
        bad = client.get("/audit", headers={"authorization": "Bearer nope"})
        assert bad.status_code == 401
        # Correct token → not 401 (200 with an empty/absent log is fine).
        ok = client.get("/audit", headers={"authorization": "Bearer s3cret-token"})
        assert ok.status_code != 401

    def test_audit_open_when_no_token(self, _client: TestClient) -> None:
        # No token configured (CI/local posture) → reachable, mirroring AuthMiddleware.
        assert _client.get("/audit").status_code != 401


class TestRequestSizeLimit:
    def test_oversized_body_rejected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TESSERA_API__MAX_REQUEST_BYTES", "1000")
        monkeypatch.delenv("TESSERA_API__BEARER_TOKEN", raising=False)
        get_settings.cache_clear()
        from tessera.api.main import build_app

        client = TestClient(build_app())
        big = {"message": "x" * 5000}
        r = client.post("/chat", json=big)
        assert r.status_code == 413


class TestDeploymentMode:
    def test_on_prem_forces_rate_limit_required(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("TESSERA_DEPLOYMENT_MODE", "on_prem")
        monkeypatch.setenv("TESSERA_API__RATE_LIMIT_ENABLED", "false")
        get_settings.cache_clear()
        s = get_settings()
        assert s.deployment_mode is DeploymentMode.ON_PREM
        assert s.is_on_prem() is True
        # On-prem cannot silently disable the limiter.
        assert s.rate_limit_required is True

    def test_cloud_run_respects_disable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TESSERA_DEPLOYMENT_MODE", "cloud_run")
        monkeypatch.setenv("TESSERA_API__RATE_LIMIT_ENABLED", "false")
        get_settings.cache_clear()
        s = get_settings()
        assert s.rate_limit_required is False


class TestSecretProvider:
    def test_default_is_env_provider(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from tessera.secrets import EnvSecretProvider, get_secret_provider

        monkeypatch.setenv("TESSERA_SECRETS__PROVIDER", "env")
        monkeypatch.setenv("FOO_SECRET", "bar")
        get_settings.cache_clear()
        get_secret_provider.cache_clear()
        provider = get_secret_provider()
        assert isinstance(provider, EnvSecretProvider)
        assert provider.get("FOO_SECRET") == "bar"
        assert provider.get("MISSING") is None

    def test_resolve_secret_reads_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from tessera.secrets import get_secret_provider, resolve_secret

        monkeypatch.setenv("TESSERA_SECRETS__PROVIDER", "env")
        monkeypatch.setenv("TESSERA_TEST_SECRET", "value-123")
        get_settings.cache_clear()
        get_secret_provider.cache_clear()
        assert resolve_secret("TESSERA_TEST_SECRET") == "value-123"

    def test_misconfigured_vault_falls_back_to_env(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from tessera.secrets import EnvSecretProvider, get_secret_provider

        # provider=vault but no url/token → must not crash; degrade to env.
        monkeypatch.setenv("TESSERA_SECRETS__PROVIDER", "vault")
        monkeypatch.delenv("TESSERA_SECRETS__VAULT_URL", raising=False)
        get_settings.cache_clear()
        get_secret_provider.cache_clear()
        assert isinstance(get_secret_provider(), EnvSecretProvider)
