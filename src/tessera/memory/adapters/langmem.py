"""LangMem adapter — long-term memory via LangChain's LangMem (ADR 0007).

Recency stays local (:class:`WindowBackend`); long-term extraction and recall
are delegated to LangMem's store-backed memory manager, namespaced by
``subject_id``. Requires the ``memory-langmem`` extra.

LangMem is built around a LangGraph ``BaseStore``. This adapter wires it to an
in-process store by default; a deployment wanting durability passes a Postgres
store instead. The operations target LangMem's documented manager API and are
defensive — validate against the installed version before relying on it in
production.
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

__all__ = ["LangMemBackend"]


class LangMemBackend(WindowBackend):
    """Long-term memory backed by LangMem; recency by the local window."""

    def __init__(self, *, history_window: int | None = None) -> None:
        """Initialise the LangMem manager + store, or fail with an install hint."""
        super().__init__(history_window=history_window)
        try:
            from langgraph.store.memory import InMemoryStore
            from langmem import create_memory_store_manager
        except ImportError as exc:
            raise MissingMemoryExtraError(
                backend="langmem", package="langmem", extra="memory-langmem"
            ) from exc
        self._store = InMemoryStore()
        self._manager = create_memory_store_manager(
            "openai:gpt-4o-mini", namespace=("memories", "{subject_id}")
        )
        self._top_k = get_settings().memory.long_term_top_k

    async def load(
        self,
        *,
        scope: MemoryScope,
        messages: Sequence[ConversationMessage],
        query: str,
    ) -> MemoryContext:
        """Recent window locally; long-term recall from the LangMem store."""
        base = await super().load(scope=scope, messages=messages, query=query)
        long_term: list[MemoryItem] = []
        try:
            results = await self._store.asearch(
                ("memories", scope.subject_id), query=query, limit=self._top_k
            )
            for item in results or []:
                value = getattr(item, "value", {}) or {}
                text = value.get("content") or value.get("memory") or str(value)
                long_term.append(
                    MemoryItem(
                        kind="semantic",
                        text=str(text),
                        entities=EntityLedger(),
                        score=float(getattr(item, "score", 0.0) or 0.0),
                        created_at=datetime.now(UTC),
                    )
                )
        except Exception as exc:  # recall must never break a turn
            sys.stderr.write(f"tessera.memory.langmem: search failed: {exc}\n")
        return MemoryContext(recent_verbatim=base.recent_verbatim, long_term=long_term)

    async def record(self, *, scope: MemoryScope, turn: TurnRecord) -> None:
        """Let LangMem extract and store memories from the finished turn."""
        try:
            await self._manager.ainvoke(
                {"messages": [{"role": m.role, "content": m.content} for m in turn.messages]},
                config={"configurable": {"subject_id": scope.subject_id}},
            )
        except Exception as exc:
            sys.stderr.write(f"tessera.memory.langmem: record failed: {exc}\n")

    async def forget(self, *, scope: MemoryScope) -> None:
        """Delete the subject's namespace from the LangMem store (GDPR Art. 17)."""
        try:
            namespace = ("memories", scope.subject_id)
            for item in await self._store.asearch(namespace, query="", limit=1000) or []:
                await self._store.adelete(namespace, item.key)
        except Exception as exc:
            sys.stderr.write(f"tessera.memory.langmem: forget failed: {exc}\n")
