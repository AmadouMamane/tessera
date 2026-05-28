"""Runtime guardrail layer for Tessera.

The guard wraps every tool invocation with a firewall check sourced from
``policy.yaml`` and the upstream :mod:`mcp_firewall` library. Decisions are
recorded as :class:`GuardDecisionRecord` entries on the agent state and as
structured audit-trail entries through :mod:`tessera.guard.audit`.

The split between the policy file (declarative) and the adapter (the code
that interprets it) is intentional — auditors should be able to read the
policy without reading any Python.
"""

from __future__ import annotations

from tessera.guard.adapter import GuardedResult, guarded_invoke
from tessera.guard.decisions import Decision, DecisionKind, Policy, load_policy

__all__ = [
    "Decision",
    "DecisionKind",
    "GuardedResult",
    "Policy",
    "guarded_invoke",
    "load_policy",
]
