"""Tessera — multilingual banking support LLM agent for the European retail market.

The public API surface is intentionally narrow: most callers should import from
the submodules directly (``tessera.agent``, ``tessera.api``, ``tessera.guard``)
rather than relying on top-level re-exports.

The package exposes only:

* :data:`__version__` — the installed package version, sourced from importlib
  metadata so that wheel and source-tree imports return the same string.
* :func:`get_settings` — the cached, lazily constructed application settings
  object. See :mod:`tessera.settings` for the full schema.
"""

from __future__ import annotations

from importlib import metadata as _metadata

from tessera.settings import Settings, get_settings

__all__ = ["Settings", "__version__", "get_settings"]


def _resolve_version() -> str:
    """Return the installed distribution version, or a dev sentinel."""
    try:
        return _metadata.version("tessera")
    except _metadata.PackageNotFoundError:  # editable install before sync
        return "0.0.0+unknown"


__version__: str = _resolve_version()
