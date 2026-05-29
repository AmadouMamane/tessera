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

from langgraph.checkpoint.memory import MemorySaver

from tessera.agent import build_graph
from tessera.agent import reporter as reporter_module
from tessera.agent.state import NodeName, new_state
from tessera.observability.metrics import AGENT_TURN_DURATION, AGENT_TURNS_TOTAL
from tessera.settings import LanguageCode, get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

router = APIRouter(tags=["chat"])

# One MemorySaver per process; thread_id = turn_id so turns never collide.
_checkpointer = MemorySaver()


def _streaming_graph() -> object:
    """Compile a graph that pauses before the reporter so we can stream tokens."""
    return build_graph().compile(
        checkpointer=_checkpointer,
        interrupt_before=[NodeName.REPORTER.value],
    )


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

    graph = _streaming_graph()
    config: dict[str, object] = {"configurable": {"thread_id": str(turn_id)}}
    started = time.perf_counter()
    yield _sse("turn.start", {"conversation_id": str(conversation_id), "turn_id": str(turn_id)})

    # Phase 1: run graph up to (but not including) the reporter node.
    # Escalation and injection-block paths complete fully here.
    try:
        await graph.ainvoke(initial, config=config)  # type: ignore[union-attr]
    except Exception as exc:
        AGENT_TURNS_TOTAL.labels(language=language.value, outcome="error").inc()
        yield _sse("turn.error", {"error": str(exc)})
        return

    snapshot = graph.get_state(config)  # type: ignore[union-attr]
    state = snapshot.values

    # Phase 2: stream reporter when the graph is paused before it.
    # Otherwise (escalation / injection block) final_response is already set.
    final_response: str
    if NodeName.REPORTER.value in (snapshot.next or ()):
        docs = state.get("retrieved_documents", [])
        draft = state.get("draft_response", "")
        tokens: list[str] = []
        if docs:
            async for token in reporter_module.astream_synthesise(state):
                tokens.append(token)
                yield _sse("turn.token", {"token": token})
            citations_footer = reporter_module.format_citations(
                state.get("citations", []), state["language"]
            )
            final_response = "".join(tokens) + citations_footer
        elif draft:
            final_response = reporter_module.render(state)
        else:
            from tessera.agent.reporter import _FALLBACK_RESPONSES  # noqa: PLC0415
            final_response = _FALLBACK_RESPONSES[state["language"]]
    else:
        final_response = str(state.get("final_response", ""))

    duration = time.perf_counter() - started
    resolved_language: LanguageCode = state.get("language", language)
    AGENT_TURN_DURATION.labels(language=resolved_language.value).observe(duration)
    needs_escalation = bool(state.get("needs_escalation", False))
    outcome: Literal["complete", "escalated"] = "escalated" if needs_escalation else "complete"
    AGENT_TURNS_TOTAL.labels(language=resolved_language.value, outcome=outcome).inc()

    envelope = ChatEnvelope(
        conversation_id=conversation_id,
        turn_id=turn_id,
        language=resolved_language,
        final_response=final_response,
        needs_escalation=needs_escalation,
        confidence=state.get("confidence"),
        citations=[
            {"source": c.source, "locator": c.locator, "language": c.language.value}
            for c in state.get("citations", [])
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
