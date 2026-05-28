"""Escalation worker — opens a human-handoff ticket and ends the turn.

The reviewer sets ``needs_escalation = True`` when it cannot in good
conscience let the reporter respond — low grounding score, repeated guard
denies, or simply an intent (card block, dispute) that requires a human by
policy. This worker creates a ticket through the
:mod:`tessera.agent.tools.ticket_escalate` tool, surfaces the ticket
reference in the user's language, and short-circuits the rest of the graph.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime

from tessera.agent.state import AgentState, ConversationMessage, ToolCallRecord
from tessera.agent.tools import ticket_escalate
from tessera.guard.adapter import guarded_invoke
from tessera.settings import LanguageCode

NODE_NAME = "escalation_worker"

_HANDOFF_TEMPLATES: dict[LanguageCode, str] = {
    LanguageCode.FR: (
        "Je transmets votre demande à un conseiller Crédit Aurore. "
        "Vous serez recontacté(e) dans les meilleurs délais. "
        "Référence du dossier : {ticket_reference}."
    ),
    LanguageCode.DE: (
        "Ich leite Ihre Anfrage an eine Beraterin oder einen Berater "
        "von Crédit Aurore weiter. Sie werden zeitnah kontaktiert. "
        "Vorgangsnummer: {ticket_reference}."
    ),
    LanguageCode.EN: (
        "I'm forwarding your request to a Crédit Aurore advisor; you will "
        "be contacted shortly. Case reference: {ticket_reference}."
    ),
}


async def run(state: AgentState) -> dict[str, object]:
    """Worker entry point."""
    reason = state.get("escalation_reason") or "human handoff requested"
    conversation_id = str(state["conversation_id"])
    language_val = state["language"].value
    transcript = state["user_input"][:500]
    arguments: dict[str, object] = {
        "conversation_id": conversation_id,
        "language": language_val,
        "reason": reason,
        "transcript_excerpt": transcript,
    }
    started = time.perf_counter()
    guarded_result = await guarded_invoke(
        tool_name="ticket_escalate",
        invoke=lambda: ticket_escalate.open_ticket(
            conversation_id=conversation_id,
            language=state["language"].value,
            reason=reason,
            transcript_excerpt=transcript,
        ),
        arguments=arguments,
        language=state["language"],
    )
    duration_ms = (time.perf_counter() - started) * 1000.0

    call = ToolCallRecord(
        tool_name="ticket_escalate",
        arguments=arguments,
        result=guarded_result.result,
        succeeded=guarded_result.allowed and guarded_result.error is None,
        error=guarded_result.error,
        started_at=datetime.now(UTC),
        duration_ms=duration_ms,
    )

    ticket_reference = (
        guarded_result.result.reference if call.succeeded and guarded_result.result else "PENDING"
    )

    final = _HANDOFF_TEMPLATES[state["language"]].format(ticket_reference=ticket_reference)

    return {
        "tool_calls": [call],
        "guard_decisions": list(guarded_result.decisions),
        "final_response": final,
        "needs_escalation": True,
        "messages": [ConversationMessage(role="assistant", content=final)],
    }
