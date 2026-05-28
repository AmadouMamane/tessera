"""Chat endpoint — invokes the agent graph and streams events as SSE.

We emit Server-Sent Events directly through Starlette's
:class:`StreamingResponse` rather than pulling a dedicated SSE helper, both
to minimise dependencies and to keep the wire format trivially auditable.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import TYPE_CHECKING, Annotated, Literal

from fastapi import APIRouter, Body
from pydantic import BaseModel, ConfigDict, Field
from starlette.responses import StreamingResponse

from tessera.agent import compile_graph
from tessera.agent.state import new_state
from tessera.observability.metrics import AGENT_TURN_DURATION, AGENT_TURNS_TOTAL
from tessera.settings import LanguageCode, get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    """Incoming chat request body."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4_000)
    conversation_id: uuid.UUID | None = None
    language: LanguageCode | None = Field(
        default=None,
        description="Optional language hint; the router will still verify.",
    )


class ChatEnvelope(BaseModel):
    """Final envelope, emitted as the last SSE event."""

    model_config = ConfigDict(extra="forbid")

    conversation_id: uuid.UUID
    turn_id: uuid.UUID
    language: LanguageCode
    final_response: str
    needs_escalation: bool
    confidence: float | None
    citations: list[dict[str, str]]
    finish_reason: Literal["complete", "escalated", "error"]


def _sse(event: str, payload: object) -> bytes:
    body = json.dumps(payload, default=str, ensure_ascii=False)
    return f"event: {event}\ndata: {body}\n\n".encode()


async def _stream_turn(request: ChatRequest) -> AsyncIterator[bytes]:
    conversation_id = request.conversation_id or uuid.uuid4()
    turn_id = uuid.uuid4()
    language = request.language or get_settings().default_language
    pinned_confidence = 1.0 if request.language is not None else 0.0

    initial = new_state(
        conversation_id=conversation_id,
        turn_id=turn_id,
        user_input=request.message,
        language=language,
        language_confidence=pinned_confidence,
    )

    graph = compile_graph()
    started = time.perf_counter()
    yield _sse(
        "turn.start",
        {"conversation_id": str(conversation_id), "turn_id": str(turn_id)},
    )

    try:
        final_state = await graph.ainvoke(initial)
    except Exception as exc:  # noqa: BLE001  visible failure mode
        AGENT_TURNS_TOTAL.labels(language=language.value, outcome="error").inc()
        yield _sse("turn.error", {"error": str(exc)})
        return

    duration = time.perf_counter() - started
    AGENT_TURN_DURATION.labels(language=language.value).observe(duration)
    outcome: Literal["complete", "escalated"] = (
        "escalated" if final_state.get("needs_escalation") else "complete"
    )
    AGENT_TURNS_TOTAL.labels(language=language.value, outcome=outcome).inc()

    envelope = ChatEnvelope(
        conversation_id=conversation_id,
        turn_id=turn_id,
        language=final_state.get("language", language),
        final_response=final_state.get("final_response", ""),
        needs_escalation=final_state.get("needs_escalation", False),
        confidence=final_state.get("confidence"),
        citations=[
            {
                "source": c.source,
                "locator": c.locator,
                "language": c.language.value,
            }
            for c in final_state.get("citations", [])
        ],
        finish_reason=outcome,
    )
    yield _sse("turn.end", envelope.model_dump())


@router.post("/chat")
async def chat(
    payload: Annotated[ChatRequest, Body(...)],
) -> StreamingResponse:
    """POST /chat — Server-Sent-Events stream of the agent's turn."""
    return StreamingResponse(
        _stream_turn(payload),
        media_type="text/event-stream",
        headers={
            "cache-control": "no-cache",
            "connection": "keep-alive",
            "x-accel-buffering": "no",  # disable nginx buffering
        },
    )
