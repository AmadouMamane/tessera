"""Card block tool — places a card in opposition.

Card blocking is destructive (irreversible without a human) so the firewall
policy requires a confirmed human-handoff *or* explicit user re-confirmation
before this tool is allowed. The tool itself does not enforce that — the
guard layer does.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "CardBlock",
    "CardBlockRequest",
    "block",
]


class CardBlockRequest(BaseModel):
    """Input schema for the card block tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    customer_id: str = Field(min_length=4, max_length=64)
    card_last_four: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    reason: Literal["lost", "stolen", "fraud_suspected", "customer_request"]


class CardBlock(BaseModel):
    """Output schema for the card block tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    card_last_four: str
    blocked_at: datetime
    ticket_reference: str = Field(
        description="Reference handed back to the customer for follow-up.",
    )
    reason: Literal["lost", "stolen", "fraud_suspected", "customer_request"]


async def block(
    *,
    customer_id: str,
    card_last_four: str,
    reason: Literal["lost", "stolen", "fraud_suspected", "customer_request"],
) -> CardBlock:
    """Place the card in opposition and return a ticket reference."""
    request = CardBlockRequest(
        customer_id=customer_id,
        card_last_four=card_last_four,
        reason=reason,
    )
    # In production this calls the card-management system; for the demo we
    # mint a reference and return it.
    reference = f"OP-{secrets.token_hex(4).upper()}"
    return CardBlock(
        card_last_four=request.card_last_four,
        blocked_at=datetime.now(UTC),
        ticket_reference=reference,
        reason=request.reason,
    )
