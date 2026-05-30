"""Nightly memory consolidation (ADR 0007, Phase 4).

Re-runs long-term memory formation over recent conversations so that durable
facts accumulate in Tier 2 without adding any latency to live turns. Intended to
run as a cron job — a Cloud Run Job or a scheduled GitHub Actions workflow —
once per day.

Usage:
    uv run python scripts/consolidate_memory.py [--since-hours N]

It reads the configured memory backend's consent and governance rules, so a
subject without retention consent is skipped automatically.
"""

from __future__ import annotations

import argparse
import asyncio
from typing import TYPE_CHECKING

from psycopg import sql

from tessera.memory import scope_for
from tessera.memory.protocol import TurnRecord
from tessera.memory.reflector import form_memories
from tessera.memory.transcript import load_transcript
from tessera.retrieval.store import get_pool
from tessera.settings import get_settings

if TYPE_CHECKING:
    from uuid import UUID


async def _recent_conversations(since_hours: int) -> list[UUID]:
    """Return conversation ids with activity in the last ``since_hours`` hours."""
    query = sql.SQL(
        """
        SELECT DISTINCT conversation_id
        FROM {table}
        WHERE created_at > now() - make_interval(hours => %s);
        """
    ).format(table=sql.Identifier("conversation_messages"))
    pool = get_pool()
    if pool.closed:
        await pool.open()
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(query, (since_hours,))
        rows = await cur.fetchall()
    return [row[0] for row in rows]


async def consolidate(since_hours: int = 24) -> int:
    """Form long-term memories for each recently-active conversation.

    Returns the number of conversations processed.
    """
    language = get_settings().default_language
    conversations = await _recent_conversations(since_hours)
    processed = 0
    for conversation_id in conversations:
        messages = await load_transcript(conversation_id)
        if not messages:
            continue
        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        last_assistant = next((m.content for m in reversed(messages) if m.role == "assistant"), "")
        turn = TurnRecord(
            user_input=last_user,
            final_response=last_assistant,
            messages=messages,
            language=language,
        )
        await form_memories(scope_for(conversation_id, language), turn)
        processed += 1
    return processed


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Consolidate recent conversations into memory.")
    parser.add_argument("--since-hours", type=int, default=24)
    args = parser.parse_args()
    count = asyncio.run(consolidate(args.since_hours))
    print(f"consolidated {count} conversation(s)")


if __name__ == "__main__":
    main()
