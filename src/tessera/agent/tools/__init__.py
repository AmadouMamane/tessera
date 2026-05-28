"""LLM-callable function-call targets for the Tessera agent.

Tools are typed, idempotent (where possible), and side-effect-bounded. They
are *not* LangGraph nodes — they expose a Pydantic-validated input schema
and a frozen Pydantic output type. Workers in
:mod:`tessera.agent.workers` wrap them with the firewall guard before
invoking.

The split between tools and workers is binding; see ADR 0005.
"""

from __future__ import annotations

from tessera.agent.tools import (
    account_balance,
    card_block,
    loan_simulate,
    ticket_escalate,
    transaction_search,
)

__all__ = [
    "account_balance",
    "card_block",
    "loan_simulate",
    "ticket_escalate",
    "transaction_search",
]
