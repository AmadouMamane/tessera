"""LangGraph worker nodes for the Tessera agent.

Workers are orchestration units, not LLM-callable tools — they own the
control flow (which retrieval call, which tool, how to merge results) and
mutate :class:`AgentState`. The LLM never invokes them directly; the planner
decides which workers to run for the current turn.

The split between workers and tools is binding; see ADR 0005.
"""

from __future__ import annotations

from tessera.agent.workers import (
    account_lookup,
    escalation,
    product_lookup,
    regulation_lookup,
    simulator,
)

__all__ = [
    "account_lookup",
    "escalation",
    "product_lookup",
    "regulation_lookup",
    "simulator",
]
