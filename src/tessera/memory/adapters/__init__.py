"""External memory-engine adapters behind the :class:`MemoryBackend` Protocol.

Each adapter maps Tessera's memory contract onto a third-party engine
(LangMem, Mem0, Zep). They are optional: the native ``window``/``summary``/
``persistent`` tiers need none of them. An adapter lazily imports its engine and
raises :class:`MissingMemoryExtraError` with an install hint when the matching
optional extra is not present, so the default install stays lean (ADR 0007).
"""

from __future__ import annotations

__all__ = ["MissingMemoryExtraError"]


class MissingMemoryExtraError(RuntimeError):
    """Raised when an external memory backend is selected without its extra."""

    def __init__(self, *, backend: str, package: str, extra: str) -> None:
        """Build a message pointing at the exact extra to install.

        Args:
            backend: The configured ``MEMORY_BACKEND`` value.
            package: The importable package that is missing.
            extra: The pip extra that provides it.
        """
        super().__init__(
            f"memory backend {backend!r} requires the {package!r} package; "
            f"install it with: pip install 'tessera[{extra}]'"
        )
