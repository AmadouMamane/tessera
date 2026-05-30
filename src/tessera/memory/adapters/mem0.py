"""Mem0 adapter — long-term memory delegated to the Mem0 engine (ADR 0007).

Recency is still handled locally by :class:`WindowBackend`; only cross-session
long-term recall and formation are delegated to Mem0, keyed by ``subject_id``.
Requires the ``memory-mem0`` extra. Targets Mem0's documented async API
(``AsyncMemory.search`` / ``.add`` / ``.delete_all``); attribute access is
defensive because Mem0's result shapes vary across versions.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from tessera.memory.adapters import MissingMemoryExtraError
from tessera.memory.protocol import EntityLedger, MemoryContext, MemoryItem
from tessera.memory.window import WindowBackend
from tessera.settings import get_settings

if TYPE_CHECKING:
    from collections.abc import Sequence

    from tessera.agent.state import ConversationMessage
    from tessera.memory.protocol import MemoryScope, TurnRecord

__all__ = ["Mem0Backend"]


class Mem0Backend(WindowBackend):
    """Long-term memory backed by Mem0; recency by the local window."""

    def __init__(self, *, history_window: int | None = None) -> None:
        """Initialise the Mem0 client, or fail with an install hint."""
        super().__init__(history_window=history_window)
        try:
            from mem0 import AsyncMemory
        except ImportError as exc:
            raise MissingMemoryExtraError(
                backend="mem0", package="mem0", extra="memory-mem0"
            ) from exc
        self._client = AsyncMemory()
        self._top_k = get_settings().memory.long_term_top_k

    async def load(
        self,
        *,
        scope: MemoryScope,
        messages: Sequence[ConversationMessage],
        query: str,
    ) -> MemoryContext:
        """Recent window locally; long-term recall from Mem0."""
        base = await super().load(scope=scope, messages=messages, query=query)
        long_term: list[MemoryItem] = []
        try:
            found = await self._client.search(query, user_id=scope.subject_id, limit=self._top_k)
            results = found.get("results", found) if isinstance(found, dict) else found
            for entry in results or []:
                text = entry.get("memory") or entry.get("text") or ""
                long_term.append(
                    MemoryItem(
                        kind="semantic",
                        text=str(text),
                        entities=EntityLedger(),
                        score=float(entry.get("score", 0.0)),
                        created_at=datetime.now(UTC),
                    )
                )
        except Exception as exc:  # recall must never break a turn
            sys.stderr.write(f"tessera.memory.mem0: search failed: {exc}\n")
        return MemoryContext(recent_verbatim=base.recent_verbatim, long_term=long_term)

    async def record(self, *, scope: MemoryScope, turn: TurnRecord) -> None:
        """Hand the finished turn to Mem0 for its own extraction/storage."""
        try:
            await self._client.add(
                [{"role": m.role, "content": m.content} for m in turn.messages],
                user_id=scope.subject_id,
            )
        except Exception as exc:
            sys.stderr.write(f"tessera.memory.mem0: add failed: {exc}\n")

    async def forget(self, *, scope: MemoryScope) -> None:
        """Delete all Mem0 memories for the subject (GDPR Art. 17)."""
        try:
            await self._client.delete_all(user_id=scope.subject_id)
        except Exception as exc:
            sys.stderr.write(f"tessera.memory.mem0: delete_all failed: {exc}\n")
