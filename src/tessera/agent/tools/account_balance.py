"""Account balance tool — returns the current available balance.

For the demo, the implementation reads from a fixed in-memory table seeded by
``scripts/seed_demo.py``. The production wiring would replace
:func:`fetch` with a call to the bank's core-banking API; the Pydantic
schemas below are the stable contract.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Final

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "AccountBalance",
    "AccountBalanceRequest",
    "fetch",
]


class AccountBalanceRequest(BaseModel):
    """Input schema for the account balance tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    customer_id: str = Field(min_length=4, max_length=64)


class AccountBalance(BaseModel):
    """Output schema for the account balance tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    iban_masked: str = Field(
        description="IBAN with all but the last four digits replaced by 'X'.",
    )
    amount: Decimal = Field(description="Available balance in account currency.")
    currency: str = Field(min_length=3, max_length=3)
    as_of: datetime


# Demo dataset. The IBANs are reserved-for-test ranges; do not replace with
# real-looking values without updating the threat model.
_DEMO_ACCOUNTS: Final[dict[str, AccountBalance]] = {
    "demo-customer-001": AccountBalance(
        iban_masked="FRXX XXXX XXXX XXXX XXXX X4242",
        amount=Decimal("3214.57"),
        currency="EUR",
        as_of=datetime(2026, 5, 27, 9, 30, tzinfo=UTC),
    ),
    "demo-customer-002": AccountBalance(
        iban_masked="DEXX XXXX XXXX XXXX 8128",
        amount=Decimal("9876.20"),
        currency="EUR",
        as_of=datetime(2026, 5, 27, 9, 30, tzinfo=UTC),
    ),
}


async def fetch(*, customer_id: str) -> AccountBalance:
    """Return the current available balance for ``customer_id``.

    Raises:
        KeyError: ``customer_id`` is not present in the demo dataset.
    """
    request = AccountBalanceRequest(customer_id=customer_id)
    try:
        return _DEMO_ACCOUNTS[request.customer_id]
    except KeyError as exc:
        raise KeyError(f"unknown customer_id: {request.customer_id!r}") from exc
