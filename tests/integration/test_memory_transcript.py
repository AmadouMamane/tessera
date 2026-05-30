"""Integration tests for the durable conversation transcript (ADR 0007, Mechanism A).

These hit a live Postgres. They are tagged ``integration`` and skip cleanly when
no database is reachable, so the fast unit loop is never blocked.
"""

from __future__ import annotations

import uuid

import psycopg
import pytest

from tessera.agent.state import ConversationMessage
from tessera.memory.transcript import (
    append_messages,
    ensure_transcript_schema,
    load_transcript,
)

pytestmark = pytest.mark.integration


@pytest.fixture
async def _schema() -> None:
    """Ensure the transcript schema exists, or skip when Postgres is unavailable.

    A short-timeout probe first so the skip is fast (~2s) rather than waiting on
    the connection pool's default 30s timeout when no database is running.
    """
    from tessera.settings import get_settings

    dsn = str(get_settings().postgres.dsn)
    try:
        conn = await psycopg.AsyncConnection.connect(dsn, connect_timeout=2)
        await conn.close()
    except (psycopg.OperationalError, OSError) as exc:
        pytest.skip(f"Postgres unavailable: {exc}")
    await ensure_transcript_schema()


@pytest.mark.usefixtures("_schema")
class TestTranscriptRoundTrip:
    async def test_append_then_load_is_chronological(self) -> None:
        conv = uuid.uuid4()
        turn1 = uuid.uuid4()
        turn2 = uuid.uuid4()
        await append_messages(
            conv,
            turn1,
            [
                ConversationMessage(role="user", content="Bonjour, mon solde ?"),
                ConversationMessage(role="assistant", content="Votre solde est de 100 €."),
            ],
        )
        await append_messages(
            conv,
            turn2,
            [
                ConversationMessage(role="user", content="Et mes dernières transactions ?"),
                ConversationMessage(role="assistant", content="Voici vos transactions."),
            ],
        )
        loaded = await load_transcript(conv)
        assert [m.role for m in loaded] == ["user", "assistant", "user", "assistant"]
        assert loaded[0].content == "Bonjour, mon solde ?"
        assert loaded[-1].content == "Voici vos transactions."

    async def test_load_limit_returns_most_recent_in_order(self) -> None:
        conv = uuid.uuid4()
        for i in range(5):
            await append_messages(
                conv,
                uuid.uuid4(),
                [ConversationMessage(role="user", content=f"q{i}")],
            )
        loaded = await load_transcript(conv, limit=2)
        assert [m.content for m in loaded] == ["q3", "q4"]

    async def test_only_user_and_assistant_roles_persist(self) -> None:
        conv = uuid.uuid4()
        await append_messages(
            conv,
            uuid.uuid4(),
            [
                ConversationMessage(role="system", content="system note"),
                ConversationMessage(role="user", content="real question"),
                ConversationMessage(role="tool", content="tool output"),
                ConversationMessage(role="assistant", content="real answer"),
            ],
        )
        loaded = await load_transcript(conv)
        assert [m.role for m in loaded] == ["user", "assistant"]

    async def test_unknown_conversation_is_empty(self) -> None:
        assert await load_transcript(uuid.uuid4()) == []
