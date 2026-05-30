"""Integration tests for Tier 1 summary + entity ledger (ADR 0007).

Hit a live Postgres for persistence; the summarisation LLM is mocked so the test
is deterministic and offline. Skips cleanly when no database is reachable.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import psycopg
import pytest

from tessera.agent.state import ConversationMessage
from tessera.memory import scope_for
from tessera.memory.protocol import TurnRecord
from tessera.memory.summary import (
    SummaryBackend,
    delete_summary,
    ensure_summary_schema,
    load_summary,
)
from tessera.settings import LanguageCode, get_settings

if TYPE_CHECKING:
    from collections.abc import Sequence

    from tessera.llm.router import ChatMessage

pytestmark = pytest.mark.integration


class _FakeSummaryBackend:
    """Deterministic stand-in for the cheap summarisation model."""

    name = "fake"
    model = "fake"

    async def chat(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float = 0.2,
        max_output_tokens: int | None = None,
    ):
        from tessera.llm.router import ChatResponse

        return ChatResponse(
            content="RÉSUMÉ FACTICE",
            model="fake",
            input_tokens=1,
            output_tokens=1,
            finish_reason="stop",
        )

    def stream_chat(self, messages, *, temperature=0.2, max_output_tokens=None):
        raise NotImplementedError


@pytest.fixture
async def _schema() -> None:
    dsn = str(get_settings().postgres.dsn)
    try:
        conn = await psycopg.AsyncConnection.connect(dsn, connect_timeout=2)
        await conn.close()
    except (psycopg.OperationalError, OSError) as exc:
        pytest.skip(f"Postgres unavailable: {exc}")
    await ensure_summary_schema()


@pytest.mark.usefixtures("_schema")
class TestSummaryBackend:
    async def test_record_compacts_older_and_preserves_entities(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("tessera.llm.router.get_summary_backend", lambda: _FakeSummaryBackend())
        conv = uuid.uuid4()
        backend = SummaryBackend(history_window=2)
        messages = [
            ConversationMessage(role="user", content="solde de 4 567,89 € selon DORA Art. 5"),
            ConversationMessage(role="assistant", content="Noté."),
            ConversationMessage(role="user", content="et mon IBAN FR76 3000 4000 0500 0600 7000"),
            ConversationMessage(role="assistant", content="Bien reçu."),
            ConversationMessage(role="user", content="question récente"),
            ConversationMessage(role="assistant", content="réponse récente"),
        ]
        turn = TurnRecord(
            user_input="question récente",
            final_response="réponse récente",
            messages=messages,
            language=LanguageCode.FR,
        )
        try:
            await backend.record(scope=scope_for(conv, LanguageCode.FR), turn=turn)
            summary, entities = await load_summary(conv)
            assert summary == "RÉSUMÉ FACTICE"
            # Entities of the OLDER turns are preserved verbatim.
            assert "4 567,89 €" in entities.amounts
            assert any("DORA" in c for c in entities.citations)
            assert any(ref.startswith("FR76") for ref in entities.account_refs)
        finally:
            await delete_summary(conv)

    async def test_record_noop_when_within_window(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("tessera.llm.router.get_summary_backend", lambda: _FakeSummaryBackend())
        conv = uuid.uuid4()
        backend = SummaryBackend(history_window=6)
        turn = TurnRecord(
            user_input="q",
            final_response="a",
            messages=[
                ConversationMessage(role="user", content="q"),
                ConversationMessage(role="assistant", content="a"),
            ],
            language=LanguageCode.FR,
        )
        await backend.record(scope=scope_for(conv, LanguageCode.FR), turn=turn)
        summary, _ = await load_summary(conv)
        assert summary is None  # nothing older than the window → no row written

    async def test_load_returns_window_and_persisted_summary(self) -> None:
        from tessera.memory.protocol import EntityLedger
        from tessera.memory.summary import save_summary

        conv = uuid.uuid4()
        try:
            await save_summary(conv, "un résumé", EntityLedger(amounts=("100 €",)))
            backend = SummaryBackend(history_window=2)
            messages = [
                ConversationMessage(role="user", content="vieux"),
                ConversationMessage(role="assistant", content="ancien"),
                ConversationMessage(role="user", content="récent u"),
                ConversationMessage(role="assistant", content="récent a"),
                ConversationMessage(role="user", content="courant"),  # current, excluded
            ]
            ctx = await backend.load(
                scope=scope_for(conv, LanguageCode.FR), messages=messages, query="courant"
            )
            assert ctx.summary == "un résumé"
            assert "100 €" in ctx.entities.amounts
            assert [m.content for m in ctx.recent_verbatim] == ["récent u", "récent a"]
        finally:
            await delete_summary(conv)
