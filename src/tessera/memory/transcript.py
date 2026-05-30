"""Durable, server-side conversation transcript — Mechanism A of ADR 0007.

This is the fix for Tessera's real memory gap: before this, conversation
continuity lived entirely in the client (the dashboard re-sent the full history
on every request). The transcript makes the **server** the source of truth, so
continuity survives client bugs and a second client, and every conversation is
replayable for the audit trail.

Why a dedicated table rather than re-keying the LangGraph checkpointer by
conversation id: ``AgentState`` carries per-turn accumulator channels
(``retrieved_documents``, ``tool_calls``, ``citations``, ``guard_decisions``,
``errors``) whose reducers *concatenate*. Persisting the whole graph state
across turns on one thread would bleed one turn's retrievals and citations into
the next. So the checkpointer stays keyed per turn (it only powers the
intra-turn streaming pause), and the cross-turn conversation record lives here —
explicit, minimal, and auditable.

The table name is composed with :class:`psycopg.sql.Identifier` and every user
value is bound as a query parameter, so the layer is injection-safe by
construction. It reuses the retrieval connection pool and manages its own
commits (it never assumes autocommit).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final

from psycopg import sql
from psycopg.rows import dict_row

from tessera.agent.state import ConversationMessage
from tessera.retrieval.store import get_pool

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

__all__ = [
    "append_messages",
    "delete_transcript",
    "ensure_transcript_schema",
    "load_transcript",
]


_TABLE: Final[sql.Identifier] = sql.Identifier("conversation_messages")
_PERSISTED_ROLES: Final[frozenset[str]] = frozenset({"user", "assistant"})


async def ensure_transcript_schema() -> None:
    """Create the transcript table and its lookup index idempotently."""
    pool = get_pool()
    if pool.closed:
        await pool.open()
    create_table = sql.SQL(
        """
        CREATE TABLE IF NOT EXISTS {table} (
            id              bigserial   PRIMARY KEY,
            conversation_id uuid        NOT NULL,
            turn_id         uuid        NOT NULL,
            seq             int         NOT NULL,
            role            text        NOT NULL,
            content         text        NOT NULL,
            name            text,
            created_at      timestamptz NOT NULL DEFAULT now()
        );
        """
    ).format(table=_TABLE)
    create_index = sql.SQL(
        "CREATE INDEX IF NOT EXISTS {idx} ON {table} (conversation_id, id);"
    ).format(idx=sql.Identifier("conversation_messages_conversation"), table=_TABLE)
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(create_table)
        await cur.execute(create_index)
        await conn.commit()


async def load_transcript(
    conversation_id: UUID,
    *,
    limit: int | None = None,
) -> list[ConversationMessage]:
    """Return the persisted messages for ``conversation_id`` in chronological order.

    Args:
        conversation_id: The conversation whose transcript to load.
        limit: When set, return only the most recent ``limit`` messages (still
            in chronological order). ``None`` returns the whole transcript.
    """
    if limit is not None:
        query = sql.SQL(
            """
            SELECT role, content, name, created_at FROM (
                SELECT role, content, name, created_at, id
                FROM {table}
                WHERE conversation_id = %s
                ORDER BY id DESC
                LIMIT %s
            ) recent
            ORDER BY id ASC;
            """
        ).format(table=_TABLE)
        params: tuple[object, ...] = (conversation_id, limit)
    else:
        query = sql.SQL(
            """
            SELECT role, content, name, created_at
            FROM {table}
            WHERE conversation_id = %s
            ORDER BY id ASC;
            """
        ).format(table=_TABLE)
        params = (conversation_id,)

    pool = get_pool()
    if pool.closed:
        await pool.open()
    async with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(query, params)
        rows = await cur.fetchall()
    return [
        ConversationMessage(
            role=row["role"],
            content=str(row["content"]),
            timestamp=row["created_at"],
            name=row["name"],
        )
        for row in rows
    ]


async def append_messages(
    conversation_id: UUID,
    turn_id: UUID,
    messages: Sequence[ConversationMessage],
) -> None:
    """Append a finished turn's user/assistant messages to the transcript.

    Only ``user`` and ``assistant`` roles are persisted; transient ``system``
    and ``tool`` messages are not part of the conversational record. Ordering
    within the turn is captured by ``seq``.
    """
    persisted = [m for m in messages if m.role in _PERSISTED_ROLES]
    if not persisted:
        return
    insert = sql.SQL(
        """
        INSERT INTO {table} (conversation_id, turn_id, seq, role, content, name)
        VALUES (%s, %s, %s, %s, %s, %s);
        """
    ).format(table=_TABLE)
    rows = [
        (conversation_id, turn_id, seq, m.role, m.content, m.name)
        for seq, m in enumerate(persisted)
    ]
    pool = get_pool()
    if pool.closed:
        await pool.open()
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.executemany(insert, rows)
        await conn.commit()


async def delete_transcript(conversation_id: UUID) -> None:
    """Delete the entire transcript for a conversation (GDPR Art. 17)."""
    query = sql.SQL("DELETE FROM {table} WHERE conversation_id = %s;").format(table=_TABLE)
    pool = get_pool()
    if pool.closed:
        await pool.open()
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, (conversation_id,))
        await conn.commit()
