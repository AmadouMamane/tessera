"""Adapter that turns the guard policy into runtime decisions.

The adapter is the single chokepoint between every worker and every tool. It
performs three jobs:

1. **Pre-flight check** — apply tool allow/deny, language restrictions, and
   argument validation; refuse to invoke the underlying tool if the check
   fails.
2. **Invoke** — call the underlying tool through a caller-supplied closure,
   so this layer never has to know which tool signature lives where.
3. **Post-flight audit** — record a :class:`GuardDecisionRecord` per decision
   into an audit sink (see :mod:`tessera.guard.audit`).

When the upstream :mod:`mcp_firewall` library is importable, the adapter
delegates its decision logic to it; otherwise it falls back to the
policy-based implementation in this module. Either way the *interface* is
identical so callers do not branch on backend availability.
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from tessera.agent.state import GuardDecisionRecord
from tessera.guard.audit import emit_audit
from tessera.guard.decisions import (
    Decision,
    DecisionKind,
    Policy,
    ToolPolicy,
    load_policy,
)
from tessera.settings import LanguageCode, get_settings

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

__all__ = ["GuardedResult", "guarded_invoke"]


@dataclass(frozen=True, slots=True)
class GuardedResult:
    """Outcome of a guarded tool invocation."""

    allowed: bool
    result: Any
    error: str | None
    decisions: tuple[GuardDecisionRecord, ...] = field(default_factory=tuple)


# ---------------------------------------------------------------------------
# Optional mcp-firewall backend
# ---------------------------------------------------------------------------


def _load_mcp_firewall() -> Any | None:
    """Return the mcp_firewall module if installed, else ``None``."""
    try:
        import mcp_firewall  # type: ignore[import-not-found]
    except ImportError:
        return None
    return mcp_firewall


_MCP_FIREWALL = _load_mcp_firewall()


# ---------------------------------------------------------------------------
# Policy-driven pre-flight
# ---------------------------------------------------------------------------


def _check_tool(
    policy: ToolPolicy,
    arguments: dict[str, object],
    language: LanguageCode,
) -> list[Decision]:
    """Apply :class:`ToolPolicy` to ``arguments``; return the decision list."""
    if not policy.allow:
        return [
            Decision(
                kind=DecisionKind.DENY,
                rule=f"tool.{policy.name}.allow",
                rationale=f"tool {policy.name!r} is not in the allowlist",
            )
        ]

    if policy.require_languages and language not in policy.require_languages:
        allowed = ", ".join(sorted(lang.value for lang in policy.require_languages))
        return [
            Decision(
                kind=DecisionKind.DENY,
                rule=f"tool.{policy.name}.require_languages",
                rationale=(
                    f"tool {policy.name!r} only allowed for languages [{allowed}]; "
                    f"current language is {language.value}"
                ),
            )
        ]

    decisions: list[Decision] = []
    for arg_name, arg_rule in policy.arguments.items():
        if arg_rule.pattern is None:
            continue
        value = arguments.get(arg_name)
        if value is None:
            continue
        if not arg_rule.pattern.fullmatch(str(value)):
            decisions.append(
                Decision(
                    kind=DecisionKind.DENY,
                    rule=f"tool.{policy.name}.argument.{arg_name}",
                    rationale=(
                        f"argument {arg_name!r} did not match the configured "
                        "validation pattern"
                    ),
                )
            )

    if not decisions:
        decisions.append(
            Decision(
                kind=DecisionKind.ALLOW,
                rule=f"tool.{policy.name}.allow",
                rationale=f"tool {policy.name!r} passed all pre-flight checks",
            )
        )
    return decisions


def _redacted_arguments(
    policy: ToolPolicy,
    arguments: dict[str, object],
    pii_patterns: tuple[Any, ...],
) -> dict[str, object]:
    """Return a copy of ``arguments`` with policy-redacted fields masked."""
    redacted: dict[str, object] = {}
    for key, value in arguments.items():
        rule = policy.arguments.get(key)
        if rule is not None and rule.redact_in_audit:
            redacted[key] = "[redacted]"
            continue
        rendered = str(value)
        for pattern in pii_patterns:
            rendered = pattern.sub("[redacted]", rendered)
        redacted[key] = rendered if rendered != str(value) else value
    return redacted


def _to_record(decision: Decision, target: str) -> GuardDecisionRecord:
    return GuardDecisionRecord(
        target=target,
        decision=decision.kind.value,  # type: ignore[arg-type]
        policy_rule=decision.rule,
        rationale=decision.rationale,
        redactions=decision.redactions,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def guarded_invoke(
    *,
    tool_name: str,
    invoke: Callable[[], Awaitable[Any] | Any],
    arguments: dict[str, object],
    language: LanguageCode,
    policy: Policy | None = None,
) -> GuardedResult:
    """Run ``invoke`` under the guard policy.

    Args:
        tool_name: The policy key for this tool (must match ``tools.<name>``).
        invoke: A zero-argument callable that performs the tool invocation.
            Synchronous and async callables are both supported.
        arguments: The argument map; used for validation and for the audit
            trail. Sensitive fields are redacted per policy.
        language: The active conversation language; some tools restrict.
        policy: Optional pre-loaded policy; defaults to
            :func:`load_policy` against the settings path.

    Returns:
        A :class:`GuardedResult` containing the result (or error), the
        allow/deny verdict, and every decision recorded for audit.
    """
    active_policy = policy or load_policy()
    tool_policy = active_policy.tool(tool_name)
    settings = get_settings()
    decisions = _check_tool(tool_policy, arguments, language)
    records = [_to_record(d, target=tool_name) for d in decisions]
    audit_args = _redacted_arguments(tool_policy, arguments, active_policy.pii_patterns)

    denied = any(d.kind is DecisionKind.DENY for d in decisions)
    if denied:
        emit_audit(
            target=tool_name,
            arguments=audit_args,
            decisions=records,
            sink=settings.guard.audit_sink,
            outcome="denied",
        )
        return GuardedResult(
            allowed=False,
            result=None,
            error="guard: tool invocation denied by policy",
            decisions=tuple(records),
        )

    try:
        result = invoke()
        if inspect.isawaitable(result):
            result = await result
    except Exception as exc:  # noqa: BLE001  forward to caller via state
        emit_audit(
            target=tool_name,
            arguments=audit_args,
            decisions=records,
            sink=settings.guard.audit_sink,
            outcome="error",
            error=str(exc),
        )
        if settings.guard.fail_closed:
            return GuardedResult(
                allowed=True,
                result=None,
                error=f"tool {tool_name!r} raised: {exc}",
                decisions=tuple(records),
            )
        raise

    emit_audit(
        target=tool_name,
        arguments=audit_args,
        decisions=records,
        sink=settings.guard.audit_sink,
        outcome="allowed",
    )
    return GuardedResult(
        allowed=True,
        result=result,
        error=None,
        decisions=tuple(records),
    )
