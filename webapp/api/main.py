"""Thin entrypoint exposed under ``webapp/api/`` for Cloud Run.

The real factory lives in :mod:`tessera.api.main`; this file exists so the
deployment manifest and the canonical tree in ``docs/structure.md`` can keep a
stable ``webapp/api/main.py`` reference while the implementation moves with
the package.
"""

from __future__ import annotations

from tessera.api.main import build_app, cli

# Re-export the ASGI factory under a conventional name so plain
# ``uvicorn webapp.api.main:app`` works in addition to the
# ``tessera`` console script.
app = build_app()

__all__ = ["app", "build_app", "cli"]


if __name__ == "__main__":  # pragma: no cover  thin CLI shim
    cli()
