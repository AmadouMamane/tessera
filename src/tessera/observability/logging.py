"""Structured logging via structlog.

Two renderers are supported:

* ``json`` (default in production) — single-line JSON, parsed by Cloud
  Logging out of the box.
* ``console`` — pretty-printed colour output for local development.
"""

from __future__ import annotations

import logging
import sys

import structlog
from structlog.typing import Processor

from tessera.settings import get_settings

__all__ = ["configure", "get_logger"]

_configured: bool = False


def _shared_processors() -> list[Processor]:
    return [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]


def configure() -> None:
    """Configure structlog and the stdlib root logger.

    Safe to call multiple times — the second call is a no-op.
    """
    global _configured
    if _configured:
        return

    settings = get_settings().observability
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=settings.log_level,
    )

    renderer: Processor
    if settings.log_format == "json":
        renderer = structlog.processors.JSONRenderer(sort_keys=False)
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())

    structlog.configure(
        processors=[*_shared_processors(), renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    _configured = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a structlog logger, configuring on first call."""
    if not _configured:
        configure()
    return structlog.get_logger(name or "tessera")
