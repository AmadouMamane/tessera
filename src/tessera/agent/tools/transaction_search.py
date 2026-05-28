"""Transaction search tool — returns recent transactions for a customer.

Bounded by a maximum lookback window (90 days) at the schema level so the
LLM cannot accidentally request a multi-year dump that would breach the
data-minimisation principle of GDPR Art. 5(1)(c).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

__all__ = [
    "Transaction",
    "TransactionSearchRequest",
    "TransactionSearchResult",
    "search",
]

_MAX_LOOKBACK_DAYS: Final[int] = 90
_MAX_RESULTS: Final[int] = 50


class TransactionSearchRequest(BaseModel):
    """Input schema for the transaction search tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    customer_id: str = Field(min_length=4, max_length=64)
    since: date
    until: date | None = None
    limit: int = Field(default=10, ge=1, le=_MAX_RESULTS)
    direction: Literal["debit", "credit", "both"] = "both"

    @model_validator(mode="after")
    def _check_window(self) -> TransactionSearchRequest:
        upper = self.until or date.today()  # noqa: DTZ011  date-only by design
        if upper < self.since:
            raise ValueError("until must be on or after since")
        if (upper - self.since).days > _MAX_LOOKBACK_DAYS:
            raise ValueError(
                f"window exceeds the {_MAX_LOOKBACK_DAYS}-day data-minimisation "
                "limit; narrow the search range"
            )
        return self


class Transaction(BaseModel):
    """One transaction record."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    posted_at: datetime
    amount: Decimal
    currency: str = Field(min_length=3, max_length=3)
    direction: Literal["debit", "credit"]
    counterparty_masked: str
    label: str


class TransactionSearchResult(BaseModel):
    """Output schema for the transaction search tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    customer_id: str
    transactions: list[Transaction]
    truncated: bool = Field(
        description="True when the underlying store had more results than the "
        "configured limit.",
    )


# Demo dataset: a small, deterministic ledger so screenshots reproduce.
_DEMO_LEDGER: Final[dict[str, list[Transaction]]] = {
    "demo-customer-001": [
        Transaction(
            posted_at=datetime(2026, 5, 26, 11, 12, tzinfo=UTC),
            amount=Decimal("-42.30"),
            currency="EUR",
            direction="debit",
            counterparty_masked="MONOPRIX PARIS XX",
            label="Carte VISA XXXX 4242",
        ),
        Transaction(
            posted_at=datetime(2026, 5, 25, 9, 0, tzinfo=UTC),
            amount=Decimal("1850.00"),
            currency="EUR",
            direction="credit",
            counterparty_masked="EMPLOYEUR XXXX",
            label="Salaire mai 2026",
        ),
    ],
}


async def search(
    *,
    customer_id: str,
    since: date,
    until: date | None = None,
    limit: int = 10,
    direction: Literal["debit", "credit", "both"] = "both",
) -> TransactionSearchResult:
    """Return up to ``limit`` transactions for ``customer_id`` in the window."""
    request = TransactionSearchRequest(
        customer_id=customer_id,
        since=since,
        until=until,
        limit=limit,
        direction=direction,
    )
    ledger = _DEMO_LEDGER.get(request.customer_id, [])
    upper = request.until or date.today()  # noqa: DTZ011
    in_window = [
        txn
        for txn in ledger
        if request.since <= txn.posted_at.date() <= upper
        and (request.direction == "both" or txn.direction == request.direction)
    ]
    truncated = len(in_window) > request.limit
    return TransactionSearchResult(
        customer_id=request.customer_id,
        transactions=in_window[: request.limit],
        truncated=truncated,
    )
