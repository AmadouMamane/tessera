"""Memory governance endpoints — GDPR erasure and consent (ADR 0007).

These expose the two regulator-facing capabilities of the memory layer:

* ``DELETE /memory/{conversation_id}`` — erase every trace of a subject across
  all memory layers (Art. 17). Total regardless of the configured backend.
* ``PUT /memory/{conversation_id}/consent`` — grant or revoke long-term
  retention consent for a subject.

The subject is identified by its conversation id while no authentication layer
exists (ADR 0007, "Identity").
"""

from __future__ import annotations

import uuid  # noqa: TCH003  — FastAPI resolves path-param annotations at runtime
from typing import Annotated

from fastapi import APIRouter, Body
from pydantic import BaseModel, ConfigDict
from starlette import status
from starlette.responses import Response

from tessera.memory import governance

router = APIRouter(tags=["memory"])


class ConsentRequest(BaseModel):
    """Body for a consent grant/revoke."""

    model_config = ConfigDict(extra="forbid")

    granted: bool


class ConsentResponse(BaseModel):
    """Current consent state for a subject."""

    model_config = ConfigDict(extra="forbid")

    subject_id: str
    granted: bool


@router.delete("/memory/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def erase_memory(conversation_id: uuid.UUID) -> Response:
    """Erase all stored memory for a subject (GDPR Art. 17)."""
    await governance.erase_subject(conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/memory/{conversation_id}/consent")
async def set_memory_consent(
    conversation_id: uuid.UUID,
    payload: Annotated[ConsentRequest, Body(...)],
) -> ConsentResponse:
    """Grant or revoke long-term retention consent for a subject."""
    subject_id = str(conversation_id)
    await governance.set_consent(subject_id, granted=payload.granted)
    return ConsentResponse(subject_id=subject_id, granted=payload.granted)
