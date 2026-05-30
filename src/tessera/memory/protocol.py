"""The memory contract — types and the :class:`MemoryBackend` Protocol.

This module is the single boundary every memory implementation honours. The
agent (the reporter, specifically) depends only on the types declared here; it
never imports a concrete backend. Swapping ``window`` for ``summary``,
``persistent``, or an external engine (LangMem / Mem0 / Zep) is therefore a
configuration change with no call-site impact — see ADR 0007.

Two axes are kept deliberately separate:

* **Thread state** — the live, in-conversation messages. These are carried by
  the LangGraph state and persisted by the checkpointer (see
  :mod:`tessera.memory.checkpointer`). ``load`` receives them as ``messages``.
* **Memory** — recency policy, compaction, and long-term recall layered *on
  top* of the thread state. This is what a :class:`MemoryBackend` owns.

Conflating the two is exactly what produced the original "checkpointer keyed by
turn" defect this design corrects.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal, Protocol, runtime_checkable

if TYPE_CHECKING:
    from collections.abc import Sequence
    from datetime import datetime
    from uuid import UUID

    from tessera.agent.state import ConversationMessage
    from tessera.settings import LanguageCode

__all__ = [
    "EntityLedger",
    "MemoryBackend",
    "MemoryContext",
    "MemoryItem",
    "MemoryScope",
    "TurnRecord",
]


@dataclass(frozen=True, slots=True)
class MemoryScope:
    """Identifies *whose* memory a call concerns.

    ``subject_id`` is the long-term identity key. Tessera has no authentication
    layer yet, so callers default it to ``str(conversation_id)`` — a per-thread
    proxy. When real customer identity arrives it replaces the proxy here and
    nowhere else (ADR 0007, "Identity").
    """

    conversation_id: UUID
    subject_id: str
    language: LanguageCode


@dataclass(frozen=True, slots=True)
class EntityLedger:
    """Literal entities preserved verbatim across compaction.

    Summarisation degrades exactly the tokens a banking agent must keep exact —
    amounts, account references, dates, regulatory citations. The ledger holds
    them as-is so they are never paraphrased by a summary model (ADR 0007,
    Tier 1). All fields are tuples to keep the dataclass hashable and frozen.
    """

    amounts: tuple[str, ...] = ()
    account_refs: tuple[str, ...] = ()
    dates: tuple[str, ...] = ()
    ticket_refs: tuple[str, ...] = ()
    products: tuple[str, ...] = ()
    citations: tuple[str, ...] = ()

    def is_empty(self) -> bool:
        """Return True when no entity of any kind has been captured."""
        return not (
            self.amounts
            or self.account_refs
            or self.dates
            or self.ticket_refs
            or self.products
            or self.citations
        )

    def merge(self, other: EntityLedger) -> EntityLedger:
        """Return a new ledger unioning ``self`` and ``other``, order-preserving."""

        def _union(left: tuple[str, ...], right: tuple[str, ...]) -> tuple[str, ...]:
            seen: dict[str, None] = {}
            for item in (*left, *right):
                seen.setdefault(item, None)
            return tuple(seen)

        return EntityLedger(
            amounts=_union(self.amounts, other.amounts),
            account_refs=_union(self.account_refs, other.account_refs),
            dates=_union(self.dates, other.dates),
            ticket_refs=_union(self.ticket_refs, other.ticket_refs),
            products=_union(self.products, other.products),
            citations=_union(self.citations, other.citations),
        )


@dataclass(frozen=True, slots=True)
class MemoryItem:
    """A single long-term memory retrieved from or written to the store.

    ``score`` is the relevance (cosine similarity) at retrieval; ``importance``
    is the stored salience of the memory. The persistent backend combines the
    two with recency into a final ranking (ADR 0007, Phase 4 scoring).
    """

    kind: Literal["semantic", "episodic"]
    text: str
    entities: EntityLedger
    score: float
    created_at: datetime
    importance: float = 0.5
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class MemoryContext:
    """Everything the reporter may inject for a turn, in priority order.

    The reporter renders these into the prompt; long-term items are always
    wrapped as untrusted *context*, never as instructions (ADR 0007,
    governance / anti-poisoning).
    """

    recent_verbatim: list[ConversationMessage]
    summary: str | None = None
    entities: EntityLedger = field(default_factory=EntityLedger)
    long_term: list[MemoryItem] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class TurnRecord:
    """The completed turn handed to ``record`` for (background) memory formation."""

    user_input: str
    final_response: str
    messages: list[ConversationMessage]
    language: LanguageCode


@runtime_checkable
class MemoryBackend(Protocol):
    """The narrow interface every memory tier and adapter implements.

    ``load`` is on the hot path (assembles prompt context); ``record`` is on the
    cold path (post-turn, must never block the user); ``forget`` is the GDPR
    Art. 17 erasure primitive every backend must support.
    """

    async def load(
        self,
        *,
        scope: MemoryScope,
        messages: Sequence[ConversationMessage],
        query: str,
    ) -> MemoryContext:
        """Assemble the memory context for the current turn.

        Args:
            scope: Whose memory, in which language.
            messages: The live thread messages from the LangGraph state,
                including the just-appended current user turn (the backend is
                responsible for excluding it from the recency window).
            query: The current user input, used to retrieve relevant long-term
                items in tiers that support it.
        """
        ...

    async def record(self, *, scope: MemoryScope, turn: TurnRecord) -> None:
        """Persist whatever the backend wishes to remember from a finished turn.

        Implementations must be safe to call as a fire-and-forget background
        task: failures are swallowed and never propagate to the user path.
        """
        ...

    async def forget(self, *, scope: MemoryScope) -> None:
        """Erase all memory held for ``scope`` (GDPR Art. 17)."""
        ...
