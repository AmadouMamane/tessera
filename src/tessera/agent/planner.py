"""Planner node — decides which workers should run for the current turn.

The planner is rule-based first, LLM-assisted second. The rule layer catches
the common, unambiguous intents (balance lookup, card block, regulatory
question) where invoking the LLM would only add latency. The LLM layer
handles ambiguous or multi-intent requests by emitting a structured plan.

Rule-based classification is deterministic and re-playable from the
non-regression harness; LLM-based planning is logged with its inputs so a
replay can substitute the recorded plan when offline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Final

from tessera.agent.state import AgentState, WorkerName
from tessera.settings import LanguageCode

__all__ = ["Intent", "classify_intent", "plan_for", "run"]


# ---------------------------------------------------------------------------
# Intent → worker dispatch table
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Intent:
    """A classified user intent and the workers it selects."""

    name: str
    workers: tuple[WorkerName, ...]
    rationale: str


_DEFAULT_PLAN: Final[tuple[WorkerName, ...]] = (
    WorkerName.REGULATION_LOOKUP,
    WorkerName.PRODUCT_LOOKUP,
)


# Multilingual cue tables. Each entry maps a regex pattern (case-insensitive,
# word-boundaries) to the intent it triggers. The order matters: more specific
# patterns first.
_INTENT_RULES: dict[LanguageCode, list[tuple[re.Pattern[str], Intent]]] = {
    LanguageCode.FR: [
        (
            re.compile(r"\b(solde|combien.*compte|état.*compte)\b", re.IGNORECASE),
            Intent(
                name="account_balance",
                workers=(WorkerName.ACCOUNT_LOOKUP,),
                rationale="French solde/balance query → ACCOUNT_LOOKUP",
            ),
        ),
        (
            re.compile(
                r"\b(bloquer|opposition|vol.*carte|carte.*vol)\b", re.IGNORECASE
            ),
            Intent(
                name="card_block",
                workers=(WorkerName.ACCOUNT_LOOKUP, WorkerName.ESCALATION),
                rationale="French card-block intent → ACCOUNT_LOOKUP + ESCALATION",
            ),
        ),
        (
            re.compile(r"\b(simul|simuler|prêt|crédit immobilier)\b", re.IGNORECASE),
            Intent(
                name="loan_simulation",
                workers=(WorkerName.SIMULATOR, WorkerName.PRODUCT_LOOKUP),
                rationale="French loan-simulation intent",
            ),
        ),
        (
            re.compile(
                r"\b(rgpd|cnil|dora|réglement|réglementation|conformité)\b",
                re.IGNORECASE,
            ),
            Intent(
                name="regulation",
                workers=(WorkerName.REGULATION_LOOKUP,),
                rationale="French regulatory keyword present",
            ),
        ),
    ],
    LanguageCode.DE: [
        (
            re.compile(r"\b(kontostand|saldo|wie viel.*konto)\b", re.IGNORECASE),
            Intent(
                name="account_balance",
                workers=(WorkerName.ACCOUNT_LOOKUP,),
                rationale="German balance query → ACCOUNT_LOOKUP",
            ),
        ),
        (
            re.compile(r"\b(karte sperren|kartensperre|karte verloren)\b", re.IGNORECASE),
            Intent(
                name="card_block",
                workers=(WorkerName.ACCOUNT_LOOKUP, WorkerName.ESCALATION),
                rationale="German card-block intent",
            ),
        ),
        (
            re.compile(r"\b(kredit|baufinanzierung|darlehen|hypothek)\b", re.IGNORECASE),
            Intent(
                name="loan_simulation",
                workers=(WorkerName.SIMULATOR, WorkerName.PRODUCT_LOOKUP),
                rationale="German loan-simulation intent",
            ),
        ),
        (
            re.compile(r"\b(dsgvo|bafin|dora|datenschutz|aufsicht)\b", re.IGNORECASE),
            Intent(
                name="regulation",
                workers=(WorkerName.REGULATION_LOOKUP,),
                rationale="German regulatory keyword present",
            ),
        ),
    ],
    LanguageCode.EN: [
        (
            re.compile(r"\b(balance|account.*balance|how much.*account)\b", re.IGNORECASE),
            Intent(
                name="account_balance",
                workers=(WorkerName.ACCOUNT_LOOKUP,),
                rationale="English balance query → ACCOUNT_LOOKUP",
            ),
        ),
        (
            re.compile(r"\b(block.*card|card.*lost|card.*stolen|freeze.*card)\b", re.IGNORECASE),
            Intent(
                name="card_block",
                workers=(WorkerName.ACCOUNT_LOOKUP, WorkerName.ESCALATION),
                rationale="English card-block intent",
            ),
        ),
        (
            re.compile(r"\b(loan|mortgage|simulate|borrow)\b", re.IGNORECASE),
            Intent(
                name="loan_simulation",
                workers=(WorkerName.SIMULATOR, WorkerName.PRODUCT_LOOKUP),
                rationale="English loan-simulation intent",
            ),
        ),
        (
            re.compile(r"\b(gdpr|dora|cnil|bafin|regulation|compliance)\b", re.IGNORECASE),
            Intent(
                name="regulation",
                workers=(WorkerName.REGULATION_LOOKUP,),
                rationale="English regulatory keyword present",
            ),
        ),
    ],
}


def classify_intent(text: str, language: LanguageCode) -> Intent | None:
    """Match ``text`` against the cue table for ``language``.

    Returns the first intent whose pattern matches, or ``None`` when nothing
    matches — in which case :func:`plan_for` falls back to the default plan.
    """
    for pattern, intent in _INTENT_RULES[language]:
        if pattern.search(text):
            return intent
    return None


def plan_for(text: str, language: LanguageCode) -> tuple[list[WorkerName], str]:
    """Return the workers to invoke and a human-readable rationale."""
    intent = classify_intent(text, language)
    if intent is None:
        return list(_DEFAULT_PLAN), "No intent matched; fan out to default lookups."
    return list(intent.workers), intent.rationale


def run(state: AgentState) -> dict[str, object]:
    """Planner node entry point."""
    plan, rationale = plan_for(state["user_input"], state["language"])
    return {"plan": plan, "plan_rationale": rationale}
