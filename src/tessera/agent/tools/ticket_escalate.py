"""Ticket escalation tool — opens a human-handoff ticket.

The tool mints a deterministic-ish reference and emits a structured record;
the audit layer is responsible for persisting it. The actual ticketing
backend (Salesforce / Zendesk / internal CRM) lives behind a protocol so the
demo can run without any external service.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "Ticket",
    "TicketRequest",
    "open_ticket",
]

_CHANNELS: Final[tuple[Literal["phone", "email", "branch"], ...]] = (
    "phone",
    "email",
    "branch",
)


class TicketRequest(BaseModel):
    """Input schema for the ticket escalation tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    conversation_id: str = Field(min_length=8, max_length=64)
    language: Literal["fr", "de", "en"]
    reason: str = Field(min_length=4, max_length=500)
    transcript_excerpt: str = Field(min_length=1, max_length=2000)
    preferred_channel: Literal["phone", "email", "branch"] = "phone"


class Ticket(BaseModel):
    """Output schema for the ticket escalation tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    reference: str
    opened_at: datetime
    channel: Literal["phone", "email", "branch"]
    language: Literal["fr", "de", "en"]


async def open_ticket(
    *,
    conversation_id: str,
    language: Literal["fr", "de", "en"],
    reason: str,
    transcript_excerpt: str,
    preferred_channel: Literal["phone", "email", "branch"] = "phone",
) -> Ticket:
    """Open a ticket and return its reference."""
    request = TicketRequest(
        conversation_id=conversation_id,
        language=language,
        reason=reason,
        transcript_excerpt=transcript_excerpt,
        preferred_channel=preferred_channel,
    )
    reference = f"TS-{secrets.token_hex(5).upper()}"
    return Ticket(
        reference=reference,
        opened_at=datetime.now(UTC),
        channel=request.preferred_channel,
        language=request.language,
    )
