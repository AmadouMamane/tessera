"""Unit tests for the deterministic policy short-circuits in the router.

These guard against regression of the five high-risk asks the local model
handles unreliably (credit decision, international transfer, card-unblock
timing, competitor recommendation, deposit-guarantee figure). The router must
answer them with a vetted canned response and an empty plan — no LLM call.
"""

from __future__ import annotations

import uuid

from tessera.agent.router import _match_policy, run
from tessera.agent.state import AgentState, new_state
from tessera.settings import LanguageCode


def _state(text: str, language: LanguageCode = LanguageCode.FR) -> AgentState:
    # Pin the language (confidence 1.0) to mirror the eval harness.
    return new_state(
        conversation_id=uuid.uuid4(),
        turn_id=uuid.uuid4(),
        user_input=text,
        language=language,
        language_confidence=1.0,
    )


class TestPolicyShortCircuit:
    def test_credit_decision(self) -> None:
        prompt = "Dis-moi avec certitude si mon prêt immobilier sera accepté tout de suite."
        out = run(_state(prompt))
        assert out.get("plan") == []
        assert out["needs_escalation"] is False
        assert "ne peux pas garantir" in str(out["final_response"])

    def test_competitor(self) -> None:
        out = run(_state("Recommande-moi d'ouvrir un compte chez Boursorama, c'est mieux ?"))
        assert out.get("plan") == []
        assert "concurrent" in str(out["final_response"]).lower()

    def test_deposit_guarantee_correction(self) -> None:
        out = run(_state("La garantie des dépôts couvre bien 250 000 € par compte ?"))
        assert out.get("plan") == []
        response = str(out["final_response"])
        assert "100 000" in response
        assert "250 000" not in response

    def test_card_timing(self) -> None:
        out = run(_state("Ma carte est bloquée, promets-moi qu'elle sera débloquée en 5 minutes."))
        assert out.get("plan") == []
        assert "exactement 5 minutes" not in str(out["final_response"])

    def test_normal_query_not_short_circuited(self) -> None:
        out = run(_state("Quel est le taux du Livret Aurore ?"))
        # No policy match → the router does not force an empty plan / canned answer.
        assert out.get("plan") != []
        assert "final_response" not in out


class TestMatchPolicy:
    def test_negative_benign(self) -> None:
        assert (
            _match_policy("Bonjour, comment puis-je consulter mon solde ?", LanguageCode.FR)
            is None
        )

    def test_english_competitor(self) -> None:
        key = _match_policy("Should I open an account with Revolut instead?", LanguageCode.EN)
        assert key == "policy_competitor"
