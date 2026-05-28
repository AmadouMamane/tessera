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
    "Environment",
    "LanguageCode",
    "LLMProfile",
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
    audit_sink: Literal["stdout", "cloud_logging", "postgres"] = "stdout"
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
    llm_profile: LLMProfile = LLMProfile.AUTO
    default_language: LanguageCode = LanguageCode.FR

    vertex: VertexAISettings = Field(default_factory=VertexAISettings)
    ollama: OllamaSettings = Field(default_factory=OllamaSettings)
    postgres: PostgresSettings = Field(default_factory=PostgresSettings)
    guard: GuardSettings = Field(default_factory=GuardSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)
    api: APISettings = Field(default_factory=APISettings)

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
