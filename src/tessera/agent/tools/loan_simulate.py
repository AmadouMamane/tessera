"""Loan simulator tool — deterministic mortgage math.

The tool computes the monthly payment for a standard fixed-rate annuity
loan. It is intentionally LLM-free: deterministic numerics keep the
regression harness reliable.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, getcontext
from typing import Final

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "LoanSimulation",
    "LoanSimulationRequest",
    "compute",
]


_MIN_AMOUNT: Final[Decimal] = Decimal("1000")
_MAX_AMOUNT: Final[Decimal] = Decimal("2000000")
_MIN_YEARS: Final[int] = 1
_MAX_YEARS: Final[int] = 30
_MIN_RATE: Final[Decimal] = Decimal("0.1")
_MAX_RATE: Final[Decimal] = Decimal("20")


class LoanSimulationRequest(BaseModel):
    """Input schema for the loan simulator tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    amount: Decimal = Field(ge=_MIN_AMOUNT, le=_MAX_AMOUNT)
    years: int = Field(ge=_MIN_YEARS, le=_MAX_YEARS)
    rate: Decimal = Field(ge=_MIN_RATE, le=_MAX_RATE, description="Annual rate in %")


class LoanSimulation(BaseModel):
    """Output schema for the loan simulator tool."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    amount: Decimal
    years: int
    rate: Decimal
    monthly_payment: Decimal
    total_interest: Decimal
    total_repayment: Decimal


def _annuity(amount: Decimal, years: int, annual_rate_pct: Decimal) -> Decimal:
    """Compute the monthly payment of a fixed-rate annuity loan.

    Uses Decimal throughout so cents are not lost to binary float drift.
    """
    getcontext().prec = 28
    monthly_rate = annual_rate_pct / Decimal("100") / Decimal("12")
    n = Decimal(years * 12)
    if monthly_rate == 0:
        payment = amount / n
    else:
        one_plus = Decimal("1") + monthly_rate
        factor = one_plus ** int(n)
        payment = amount * monthly_rate * factor / (factor - Decimal("1"))
    return payment.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def compute(*, amount: float | Decimal, years: int, rate: float | Decimal) -> LoanSimulation:
    """Return the monthly payment, total interest, and total repayment."""
    request = LoanSimulationRequest(
        amount=Decimal(str(amount)),
        years=years,
        rate=Decimal(str(rate)),
    )
    monthly = _annuity(request.amount, request.years, request.rate)
    total_repayment = (monthly * Decimal(request.years * 12)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_interest = (total_repayment - request.amount).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return LoanSimulation(
        amount=request.amount,
        years=request.years,
        rate=request.rate,
        monthly_payment=monthly,
        total_interest=total_interest,
        total_repayment=total_repayment,
    )
