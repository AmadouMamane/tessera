"""Agent memory — durable thread state plus a pluggable memory backend.

See ADR 0007 for the full design. The public surface is intentionally tiny:

* the contract types in :mod:`tessera.memory.protocol`;
* :func:`get_memory_backend`, which resolves the configured backend.

Everything else (tiers, adapters, governance, the checkpointer) is an
implementation detail behind that contract.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from tessera.memory.protocol import (
    EntityLedger,
    MemoryBackend,
    MemoryContext,
    MemoryItem,
    MemoryScope,
    TurnRecord,
)
from tessera.settings import get_settings

if TYPE_CHECKING:
    from uuid import UUID

    from tessera.settings import LanguageCode

__all__ = [
    "EntityLedger",
    "MemoryBackend",
    "MemoryContext",
    "MemoryItem",
    "MemoryScope",
    "TurnRecord",
    "get_memory_backend",
    "scope_for",
]


def scope_for(conversation_id: UUID, language: LanguageCode) -> MemoryScope:
    """Build a :class:`MemoryScope`, defaulting ``subject_id`` to the thread id.

    Until an authentication layer supplies a real customer identity, the
    conversation id is the long-term subject proxy (ADR 0007, "Identity").
    """
    return MemoryScope(
        conversation_id=conversation_id,
        subject_id=str(conversation_id),
        language=language,
    )


@lru_cache(maxsize=1)
def get_memory_backend() -> MemoryBackend:
    """Return the process-wide memory backend selected by settings.

    Backends are imported lazily so the default install needs none of the
    optional external engines. Tests that flip ``TESSERA_MEMORY__BACKEND`` must
    call ``get_memory_backend.cache_clear()`` after mutating the environment.
    """
    backend = get_settings().memory.backend
    if backend == "window":
        from tessera.memory.window import WindowBackend

        return WindowBackend()
    if backend == "summary":
        from tessera.memory.summary import SummaryBackend

        return SummaryBackend()
    if backend == "persistent":
        from tessera.memory.persistent import PersistentBackend

        return PersistentBackend()
    if backend == "langmem":
        from tessera.memory.adapters.langmem import LangMemBackend

        return LangMemBackend()
    if backend == "mem0":
        from tessera.memory.adapters.mem0 import Mem0Backend

        return Mem0Backend()
    from tessera.memory.adapters.zep import ZepBackend

    return ZepBackend()
