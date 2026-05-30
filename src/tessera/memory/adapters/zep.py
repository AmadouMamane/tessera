"""Zep adapter — long-term memory delegated to Zep (ADR 0007).

Recency stays local (:class:`WindowBackend`); cross-session memory is delegated
to Zep, with the ``subject_id`` used as the Zep session/user key. Requires the
``memory-zep`` extra. Targets Zep's documented async client; result access is
defensive across client versions.
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

__all__ = ["ZepBackend"]


class ZepBackend(WindowBackend):
    """Long-term memory backed by Zep; recency by the local window."""

    def __init__(self, *, history_window: int | None = None) -> None:
        """Initialise the Zep client, or fail with an install hint."""
        super().__init__(history_window=history_window)
        try:
            from zep_python.client import AsyncZep
        except ImportError as exc:
            raise MissingMemoryExtraError(
                backend="zep", package="zep_python", extra="memory-zep"
            ) from exc
        settings = get_settings()
        # API key/URL come from the environment in the deployed config; the
        # client reads them itself. Kept minimal here on purpose.
        self._client = AsyncZep(api_key="")
        self._top_k = settings.memory.long_term_top_k

    async def load(
        self,
        *,
        scope: MemoryScope,
        messages: Sequence[ConversationMessage],
        query: str,
    ) -> MemoryContext:
        """Recent window locally; long-term recall from Zep search."""
        base = await super().load(scope=scope, messages=messages, query=query)
        long_term: list[MemoryItem] = []
        try:
            found = await self._client.memory.search_sessions(
                text=query, user_id=scope.subject_id, limit=self._top_k
            )
            results = getattr(found, "results", found) or []
            for entry in results:
                text = getattr(getattr(entry, "message", None), "content", "") or ""
                long_term.append(
                    MemoryItem(
                        kind="semantic",
                        text=str(text),
                        entities=EntityLedger(),
                        score=float(getattr(entry, "score", 0.0) or 0.0),
                        created_at=datetime.now(UTC),
                    )
                )
        except Exception as exc:  # recall must never break a turn
            sys.stderr.write(f"tessera.memory.zep: search failed: {exc}\n")
        return MemoryContext(recent_verbatim=base.recent_verbatim, long_term=long_term)

    async def record(self, *, scope: MemoryScope, turn: TurnRecord) -> None:
        """Persist the finished turn to the subject's Zep session."""
        try:
            await self._client.memory.add(
                session_id=scope.subject_id,
                messages=[{"role": m.role, "content": m.content} for m in turn.messages],
            )
        except Exception as exc:
            sys.stderr.write(f"tessera.memory.zep: add failed: {exc}\n")

    async def forget(self, *, scope: MemoryScope) -> None:
        """Delete the subject's Zep session (GDPR Art. 17)."""
        try:
            await self._client.memory.delete(session_id=scope.subject_id)
        except Exception as exc:
            sys.stderr.write(f"tessera.memory.zep: delete failed: {exc}\n")
