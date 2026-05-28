"""FastAPI application factory and uvicorn entry point.

The factory wires every cross-cutting concern in a single place:

* OTel tracing, Prometheus metrics, structlog logging.
* Bearer-token auth middleware (configured per environment).
* Request-ID propagation for cross-service correlation.
* CORS for the bundled dashboard.
* All routers (chat, audit, health).

The :func:`cli` entry point is exposed as the ``tessera`` console script in
``pyproject.toml`` — it boots uvicorn against the factory.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from tessera import __version__
from tessera.api.middleware import AuthMiddleware, RequestIdMiddleware
from tessera.api.routes import audit, chat, health
from tessera.observability import logging as obs_logging, metrics, traces
from tessera.retrieval.store import get_pool
from tessera.settings import get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

__all__ = ["build_app", "cli"]


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Open + close the resources that outlive a single request."""
    obs_logging.configure()
    traces.configure()
    metrics.configure()
    pool = get_pool()
    try:
        await pool.open()
        yield
    finally:
        await pool.close()


def build_app() -> FastAPI:
    """Construct the FastAPI application."""
    settings = get_settings()
    app = FastAPI(
        title="Tessera",
        version=__version__,
        description=(
            "Multilingual (FR/DE/EN) banking support LLM agent, grounded in EU "
            "regulatory corpora and guarded by mcp-firewall."
        ),
        docs_url=None if settings.is_production() else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production() else "/openapi.json",
        lifespan=_lifespan,
    )

    if settings.api.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.api.cors_origins,
            allow_methods=["GET", "POST"],
            allow_headers=["authorization", "content-type", "x-request-id"],
            allow_credentials=False,
        )

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(AuthMiddleware)

    app.include_router(health.router)
    app.include_router(chat.router)
    app.include_router(audit.router)

    FastAPIInstrumentor.instrument_app(app)
    return app


def cli() -> None:
    """Console-script entry point — boots the API via uvicorn."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "tessera.api.main:build_app",
        host=settings.api.host,
        port=settings.api.port,
        factory=True,
        log_level=settings.observability.log_level.lower(),
        access_log=False,  # delegated to structlog via middleware
    )
