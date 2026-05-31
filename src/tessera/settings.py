"""Centralised, typed configuration for Tessera.

Settings flow in three layers, in decreasing precedence:

1. Explicit constructor arguments (used by tests and scripts).
2. Process environment variables, prefixed with ``TESSERA_``.
3. A local development override file at ``.env.local`` (gitignored).

In production on Cloud Run, secrets are mounted from GCP Secret Manager into
the environment by the container start-up wrapper — callers therefore see them
as plain env vars and never have to know about Secret Manager directly.

The settings object is cached behind :func:`get_settings`; tests can clear the
cache with ``get_settings.cache_clear()`` after mutating the environment.

This module is intentionally dependency-light (only pydantic-settings) so it
can be imported from any layer — agent, retrieval, guard, API — without
triggering heavy LLM client initialisation.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, HttpUrl, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

__all__ = [
    "DeploymentMode",
    "Environment",
    "LanguageCode",
    "LLMProfile",
    "MemorySettings",
    "Settings",
    "get_settings",
]


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class Environment(StrEnum):
    """Deployment environment the process believes it is running in."""

    LOCAL = "local"
    CI = "ci"
    STAGING = "staging"
    PRODUCTION = "production"


class LLMProfile(StrEnum):
    """Which LLM backend the router should prefer.

    ``frontier`` routes through Vertex AI; ``on_prem`` routes through a local
    Ollama serving Llama 3.3 70B; ``auto`` selects ``frontier`` when Vertex AI
    credentials are present and falls back to ``on_prem`` otherwise.
    """

    FRONTIER = "frontier"
    ON_PREM = "on_prem"
    AUTO = "auto"


class LanguageCode(StrEnum):
    """Supported user-input languages — frozen by CLAUDE.md."""

    FR = "fr"
    DE = "de"
    EN = "en"


class DeploymentMode(StrEnum):
    """Where Tessera is deployed (ADR 0008).

    Load-bearing for security: ``on_prem`` has no managed load balancer, secret
    manager, or platform rate limiter underneath, so app-level controls that are
    *defence in depth* on Cloud Run become the *primary* line of defence there.
    """

    CLOUD_RUN = "cloud_run"
    ON_PREM = "on_prem"


# ---------------------------------------------------------------------------
# Nested setting blocks
# ---------------------------------------------------------------------------


class VertexAISettings(BaseSettings):
    """Vertex AI (frontier path) configuration."""

    model_config = SettingsConfigDict(env_prefix="TESSERA_VERTEX_", extra="ignore")

    project_id: str | None = None
    location: str = "europe-west1"
    chat_model: str = "gemini-2.0-flash-001"
    embedding_model: str = "text-multilingual-embedding-002"
    embedding_dimension: int = 768
    timeout_seconds: float = 30.0
    max_output_tokens: int = 2048


class OllamaSettings(BaseSettings):
    """Ollama (on-prem path) configuration."""

    model_config = SettingsConfigDict(env_prefix="TESSERA_OLLAMA_", extra="ignore")

    host: HttpUrl = Field(default=HttpUrl("http://localhost:11434"))
    chat_model: str = "llama3.3:70b"
    embedding_model: str = "bge-m3"
    embedding_dimension: int = 1024
    timeout_seconds: float = 120.0
    keep_alive_seconds: int = 600


class PostgresSettings(BaseSettings):
    """Postgres + pgvector configuration."""

    model_config = SettingsConfigDict(env_prefix="TESSERA_POSTGRES_", extra="ignore")

    dsn: PostgresDsn = Field(
        default=PostgresDsn("postgresql://tessera:tessera@localhost:5432/tessera"),
    )
    pool_min_size: int = 1
    pool_max_size: int = 10
    statement_timeout_ms: int = 5_000
    vector_table: str = "documents"


class GuardSettings(BaseSettings):
    """Runtime guardrail configuration — wraps mcp-firewall."""

    model_config = SettingsConfigDict(env_prefix="TESSERA_GUARD_", extra="ignore")

    policy_path: Path = Path("src/tessera/guard/policy.yaml")
    audit_sink: Literal["stdout", "file", "cloud_logging", "postgres"] = "file"
    audit_file: Path = Path("/tmp/tessera/audit.log")
    fail_closed: bool = True
    escalation_confidence_threshold: float = 0.6

    @field_validator("escalation_confidence_threshold")
    @classmethod
    def _threshold_is_a_probability(cls, value: float) -> float:
        if not 0.0 <= value <= 1.0:
            raise ValueError(
                "escalation_confidence_threshold must be in [0.0, 1.0]; " f"got {value!r}"
            )
        return value


class ObservabilitySettings(BaseSettings):
    """Logging, tracing, and metrics configuration."""

    model_config = SettingsConfigDict(env_prefix="TESSERA_OBS_", extra="ignore")

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "console"] = "json"
    otel_endpoint: str | None = None
    otel_service_name: str = "tessera-agent"
    cloud_logging_project: str | None = None
    metrics_enabled: bool = True
    metrics_port: int = 9090


class APISettings(BaseSettings):
    """HTTP layer configuration."""

    model_config = SettingsConfigDict(env_prefix="TESSERA_API_", extra="ignore")

    host: str = "0.0.0.0"  # noqa: S104  Cloud Run requires bind-all
    port: int = 8080
    cors_origins: list[str] = Field(default_factory=list)
    request_timeout_seconds: float = 60.0
    streaming_enabled: bool = True
    bearer_token: SecretStr | None = None

    # -- Security hardening (ADR 0008) ---------------------------------------
    # TLS is terminated by Cloud Run; an on-prem reverse proxy may not, in which
    # case HSTS must stay off. Drives the security-headers middleware.
    tls_terminated: bool = True
    security_headers_enabled: bool = True

    # Rate limiting (slowapi). Defaults are conservative; tune per environment.
    rate_limit_enabled: bool = True
    rate_limit_chat: str = "20/minute"
    rate_limit_read: str = "120/minute"
    # Optional shared store (e.g. "redis://host:6379") for correct limits across
    # multiple Cloud Run instances; in-memory (per-instance) when unset.
    rate_limit_storage_uri: str | None = None

    # Global request-body ceiling, in addition to per-field Pydantic caps.
    max_request_bytes: int = 256_000


class MemorySettings(BaseSettings):
    """Agent memory configuration — see ADR 0007.

    ``backend`` selects the :class:`~tessera.memory.protocol.MemoryBackend`
    implementation; everything else is shared knob territory the active backend
    is free to read or ignore. The default (``window``) is lossless and free,
    matching the short-conversation common case of retail banking support.
    """

    model_config = SettingsConfigDict(env_prefix="TESSERA_MEMORY_", extra="ignore")

    backend: Literal[
        "window",  # Tier 0 — sliding window (default)
        "summary",  # Tier 1 — summary buffer + entity ledger
        "persistent",  # Tier 2 — cross-session, pgvector Store
        "langmem",  # external adapter (extra: memory-langmem)
        "mem0",  # external adapter (extra: memory-mem0)
        "zep",  # external adapter (extra: memory-zep)
    ] = "window"

    # Recency window: number of prior (user/assistant) messages kept verbatim.
    history_window: int = 6
    # Token budget above which Tier 1 compacts older turns into a summary.
    token_budget: int = 2_000
    # Whether long-term (Tier 2) writes are allowed absent an explicit consent
    # flag. Conservative default: no long-term retention without consent.
    consent_default: bool = False
    # Number of long-term items retrieved and injected per turn (Tier 2).
    long_term_top_k: int = 5

    @field_validator("history_window", "long_term_top_k", "token_budget")
    @classmethod
    def _non_negative(cls, value: int) -> int:
        if value < 0:
            raise ValueError(f"memory size knobs must be >= 0; got {value!r}")
        return value


# ---------------------------------------------------------------------------
# Root settings
# ---------------------------------------------------------------------------


class Settings(BaseSettings):
    """Top-level Tessera configuration.

    All fields are populated from environment variables prefixed with
    ``TESSERA_`` (with nested fields using a double-underscore delimiter, e.g.
    ``TESSERA_VERTEX__PROJECT_ID``). For local development, values can be
    placed in ``.env.local`` next to the repository root.

    Attributes:
        environment: The deployment context (local, ci, staging, production).
        llm_profile: Which LLM backend to prefer.
        default_language: Fallback language when detection is unavailable.
        vertex: Vertex AI settings.
        ollama: Ollama settings.
        postgres: Postgres + pgvector settings.
        guard: Runtime guardrail settings.
        observability: Logging, tracing, and metrics settings.
        api: HTTP layer settings.
        memory: Agent memory settings (ADR 0007).
    """

    model_config = SettingsConfigDict(
        env_prefix="TESSERA_",
        env_nested_delimiter="__",
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        validate_default=True,
    )

    environment: Environment = Environment.LOCAL
    deployment_mode: DeploymentMode = DeploymentMode.CLOUD_RUN
    llm_profile: LLMProfile = LLMProfile.AUTO
    default_language: LanguageCode = LanguageCode.FR

    vertex: VertexAISettings = Field(default_factory=VertexAISettings)
    ollama: OllamaSettings = Field(default_factory=OllamaSettings)
    postgres: PostgresSettings = Field(default_factory=PostgresSettings)
    guard: GuardSettings = Field(default_factory=GuardSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)
    api: APISettings = Field(default_factory=APISettings)
    memory: MemorySettings = Field(default_factory=MemorySettings)

    def resolved_llm_profile(self) -> LLMProfile:
        """Materialise ``LLMProfile.AUTO`` into a concrete profile.

        ``frontier`` requires a Vertex AI project id to be set; otherwise we
        fall back to the on-prem Ollama path. This is the only place that
        knows the resolution rule — callers should always go through it.
        """
        if self.llm_profile is not LLMProfile.AUTO:
            return self.llm_profile
        if self.vertex.project_id is not None:
            return LLMProfile.FRONTIER
        return LLMProfile.ON_PREM

    def is_production(self) -> bool:
        """Return True when running with production-grade safety expectations."""
        return self.environment is Environment.PRODUCTION

    def is_on_prem(self) -> bool:
        """True on the self-hosted path (no managed platform underneath)."""
        return self.deployment_mode is DeploymentMode.ON_PREM

    @property
    def rate_limit_required(self) -> bool:
        """Rate limiting is mandatory on-prem; recommended (default-on) on cloud.

        On-prem has no upstream load balancer to absorb abuse, so the control
        cannot be silently disabled there (ADR 0008, control × mode matrix).
        """
        return self.api.rate_limit_enabled or self.is_on_prem()

    @property
    def hsts_enabled(self) -> bool:
        """Send HSTS only when TLS is actually terminated for this deployment."""
        return self.api.tls_terminated


# ---------------------------------------------------------------------------
# Cached accessor
# ---------------------------------------------------------------------------

Cached = Annotated[Settings, "process-wide cached settings instance"]


@lru_cache(maxsize=1)
def get_settings() -> Cached:
    """Return the cached process-wide :class:`Settings` instance.

    Tests should call ``get_settings.cache_clear()`` whenever they mutate the
    environment to ensure subsequent reads reflect the change.
    """
    return Settings()
