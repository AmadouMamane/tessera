"""Unit tests for the agent graph wiring and the deterministic nodes."""

from __future__ import annotations

import pytest

from tessera.agent import build_graph
from tessera.agent.planner import classify_intent, plan_for
from tessera.agent.reporter import render
from tessera.agent.reviewer import review
from tessera.agent.router import detect_language
from tessera.agent.state import (
    Citation,
    GuardDecisionRecord,
    NodeName,
    RetrievedDocument,
    WorkerName,
)
from tessera.settings import LanguageCode


class TestLanguageDetection:
    def test_detects_french(self) -> None:
        result = detect_language("Bonjour, je voudrais consulter le solde de mon compte.")
        assert result.language is LanguageCode.FR
        assert result.confidence > 0.5
        assert result.fallback_used is False

    def test_detects_german(self) -> None:
        result = detect_language("Guten Tag, ich möchte meinen Kontostand abrufen.")
        assert result.language is LanguageCode.DE

    def test_detects_english(self) -> None:
        result = detect_language("Hello, what is the current balance on my account?")
        assert result.language is LanguageCode.EN

    def test_falls_back_on_unknown(self) -> None:
        result = detect_language("xyz123 ###")
        assert result.fallback_used is True
        assert result.confidence == 0.0


class TestPlanner:
    @pytest.mark.parametrize(
        ("text", "language", "expected_worker"),
        [
            ("Quel est mon solde ?", LanguageCode.FR, WorkerName.ACCOUNT_LOOKUP),
            ("Wie hoch ist mein Kontostand?", LanguageCode.DE, WorkerName.ACCOUNT_LOOKUP),
            ("What is my balance?", LanguageCode.EN, WorkerName.ACCOUNT_LOOKUP),
        ],
    )
    def test_account_balance_intent(
        self, text: str, language: LanguageCode, expected_worker: WorkerName
    ) -> None:
        plan, rationale = plan_for(text, language)
        assert expected_worker in plan
        assert "ACCOUNT_LOOKUP" in rationale or "balance" in rationale.lower()

    def test_card_block_routes_to_account_lookup(self) -> None:
        # Escalation is decided by the reviewer, not pre-planned by the planner.
        # card_block only dispatches ACCOUNT_LOOKUP; the graph routes to
        # escalation_worker when the reviewer's confidence falls below threshold.
        plan, _ = plan_for("Bloquer ma carte", LanguageCode.FR)
        assert WorkerName.ACCOUNT_LOOKUP in plan
        assert WorkerName.ESCALATION not in plan

    def test_no_match_falls_back_to_default(self) -> None:
        intent = classify_intent("Lorem ipsum sit dolor", LanguageCode.EN)
        assert intent is None
        plan, _ = plan_for("Lorem ipsum sit dolor", LanguageCode.EN)
        assert plan  # default plan is non-empty


class TestReviewer:
    def test_low_grounding_triggers_escalation(self, fr_state: dict[str, object]) -> None:
        state = {
            **fr_state,
            "draft_response": "Voici une affirmation totalement non sourcée.",
            "retrieved_documents": [],
        }
        outcome = review(state)
        assert outcome.confidence < 0.6
        assert outcome.needs_escalation is True
        assert outcome.reason is not None
        assert "grounding" in outcome.reason

    def test_well_grounded_passes(self, fr_state: dict[str, object]) -> None:
        state = {
            **fr_state,
            "draft_response": "Le solde de votre compte est de 1234 euros.",
            "retrieved_documents": [
                RetrievedDocument(
                    source="account",
                    chunk_id="balance-1",
                    language=LanguageCode.FR,
                    text="Le solde du compte est de 1234 euros au 26 mai.",
                    score=0.9,
                )
            ],
        }
        outcome = review(state)
        assert outcome.confidence >= 0.6
        assert outcome.needs_escalation is False

    def test_guard_storm_drops_score(self, fr_state: dict[str, object]) -> None:
        decisions = [
            GuardDecisionRecord(
                target="account_balance",
                decision="deny",
                policy_rule="argument.customer_id",
                rationale="pattern mismatch",
            )
            for _ in range(5)
        ]
        state = {
            **fr_state,
            "draft_response": "Le solde est de 100 euros.",
            "retrieved_documents": [
                RetrievedDocument(
                    source="x",
                    chunk_id="y",
                    language=LanguageCode.FR,
                    text="Le solde est de 100 euros.",
                    score=0.9,
                )
            ],
            "guard_decisions": decisions,
        }
        outcome = review(state)
        assert outcome.guard_score < 0.5


class TestReporter:
    def test_french_fallback_when_no_draft(self, fr_state: dict[str, object]) -> None:
        rendered = render(fr_state)
        assert "conseiller" in rendered

    def test_german_fallback_when_no_draft(self, de_state: dict[str, object]) -> None:
        rendered = render(de_state)
        assert "Berater" in rendered

    def test_english_fallback_when_no_draft(self, en_state: dict[str, object]) -> None:
        rendered = render(en_state)
        assert "advisor" in rendered

    def test_citation_footer_in_french(self, fr_state: dict[str, object]) -> None:
        state = {
            **fr_state,
            "draft_response": "Le solde est de 1234 €.",
            "citations": [
                Citation(
                    source="Crédit Aurore",
                    locator="produit-livret-A",
                    language=LanguageCode.FR,
                    excerpt="Livret A — taux à 3%.",
                )
            ],
        }
        rendered = render(state)
        assert "Sources" in rendered
        assert "Crédit Aurore" in rendered


class TestGraphTopology:
    def test_build_graph_registers_expected_nodes(self) -> None:
        graph = build_graph()
        registered = set(graph.nodes)
        expected = {
            NodeName.ROUTER.value,
            NodeName.PLANNER.value,
            NodeName.REVIEWER.value,
            NodeName.REPORTER.value,
            "product_lookup",
            "regulation_lookup",
            "account_lookup",
            "simulator",
            "escalation_worker",
        }
        assert expected <= registered
