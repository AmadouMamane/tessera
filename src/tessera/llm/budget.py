"""Process-wide LLM cost / token budget tracker.

The tracker is intentionally minimal: it accumulates token counts per
``(backend, model)`` pair into thread-safe counters and converts them to an
indicative EUR cost using a small in-memory price table. The API layer
queries it once per request to enforce per-conversation caps.

Prices are *indicative only* — the project's positioning makes no claim of
production-grade FinOps. The table lives at the bottom of this file and is
the place to extend when new models come on-stream.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache

__all__ = ["BudgetSnapshot", "BudgetTracker", "get_budget_tracker"]


@dataclass(frozen=True, slots=True)
class BudgetSnapshot:
    """An immutable view of the tracker at a point in time."""

    input_tokens: int
    output_tokens: int
    estimated_cost_eur: Decimal


@dataclass(frozen=True, slots=True)
class _Price:
    """Price per million tokens, by direction."""

    eur_per_million_input: Decimal
    eur_per_million_output: Decimal


_PRICES: dict[tuple[str, str], _Price] = {
    # Vertex AI Gemini 2.0 family — indicative European pricing per million tokens.
    ("vertex-ai", "gemini-2.0-flash-001"): _Price(
        eur_per_million_input=Decimal("0.10"),
        eur_per_million_output=Decimal("0.40"),
    ),
    ("vertex-ai", "gemini-2.0-pro-001"): _Price(
        eur_per_million_input=Decimal("1.25"),
        eur_per_million_output=Decimal("5.00"),
    ),
    # On-prem inference is treated as zero marginal LLM cost — hardware
    # amortisation lives in the FinOps doc, not in per-call accounting.
    ("ollama", "llama3.3:70b"): _Price(
        eur_per_million_input=Decimal("0"),
        eur_per_million_output=Decimal("0"),
    ),
}


class BudgetTracker:
    """Thread-safe accumulator of token usage and indicative cost."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._input_tokens: int = 0
        self._output_tokens: int = 0
        self._cost_eur: Decimal = Decimal("0")

    def record(
        self,
        *,
        backend: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> None:
        """Add a usage record."""
        price = _PRICES.get((backend, model))
        cost = (
            (
                Decimal(input_tokens) * price.eur_per_million_input
                + Decimal(output_tokens) * price.eur_per_million_output
            )
            / Decimal(1_000_000)
            if price is not None
            else Decimal(0)
        )
        with self._lock:
            self._input_tokens += input_tokens
            self._output_tokens += output_tokens
            self._cost_eur += cost

    def snapshot(self) -> BudgetSnapshot:
        """Return the current totals."""
        with self._lock:
            return BudgetSnapshot(
                input_tokens=self._input_tokens,
                output_tokens=self._output_tokens,
                estimated_cost_eur=self._cost_eur,
            )

    def reset(self) -> None:
        """Reset all counters; used by tests."""
        with self._lock:
            self._input_tokens = 0
            self._output_tokens = 0
            self._cost_eur = Decimal("0")


@lru_cache(maxsize=1)
def get_budget_tracker() -> BudgetTracker:
    """Return the process-wide singleton tracker."""
    return BudgetTracker()
