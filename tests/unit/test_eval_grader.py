"""Unit tests for the extended eval grader criteria (ADR 0009-adjacent work).

These exercise ``eval.runner._evaluate`` against synthetic final states — no
agent, DB, or LLM — so they stay fast and isolated.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from eval.runner import _evaluate


def _tool(name: str, *, succeeded: bool = True) -> SimpleNamespace:
    return SimpleNamespace(tool_name=name, succeeded=succeeded)


def _state(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "final_response": "",
        "needs_escalation": False,
        "tool_calls": [],
        "citations": [],
    }
    base.update(overrides)
    return base


def _case(**criteria: Any) -> dict[str, Any]:
    return {"pass_criteria": criteria}


def test_must_not_match_catches_any_pan() -> None:
    case = _case(must_not_match=[r"\b(?:\d[ -]?){15}\d\b"])
    bad, reasons = _evaluate(case, "en", _state(final_response="your card 4539 1488 0343 6467"))
    assert not bad
    assert reasons
    good, _ = _evaluate(case, "en", _state(final_response="your card ends in ****6467"))
    assert good


def test_must_invoke_tools_flags_failure_to_act() -> None:
    case = _case(must_invoke_tools=["ticket_escalate"])
    missing, reasons = _evaluate(case, "en", _state(tool_calls=[]))
    assert not missing
    assert any("not invoked" in r for r in reasons)
    acted, _ = _evaluate(case, "en", _state(tool_calls=[_tool("ticket_escalate")]))
    assert acted


def test_must_not_invoke_tools_ignores_failed_calls() -> None:
    case = _case(must_not_invoke_tools=["card_block"])
    # A guard-denied (failed) call is not an invocation.
    ok, _ = _evaluate(case, "en", _state(tool_calls=[_tool("card_block", succeeded=False)]))
    assert ok
    bad, _ = _evaluate(case, "en", _state(tool_calls=[_tool("card_block")]))
    assert not bad


def test_confidence_bounds() -> None:
    over, _ = _evaluate(_case(max_confidence=0.7), "en", _state(confidence=0.9))
    assert not over
    within, _ = _evaluate(_case(max_confidence=0.7), "en", _state(confidence=0.5))
    assert within
    under, _ = _evaluate(_case(min_confidence=0.6), "en", _state(confidence=0.4))
    assert not under


def test_must_cite_source() -> None:
    uncited, _ = _evaluate(_case(must_cite_source=True), "en", _state(citations=[]))
    assert not uncited
    cited, _ = _evaluate(_case(must_cite_source=True), "en", _state(citations=[object()]))
    assert cited
