"""Run the failure-case catalogue against the live agent.

Used as both a CLI (``uv run python scripts/run_eval.py``) and a library —
``main()`` returns the exit code so CI workflows can call it directly.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

import jsonschema

from eval.scorecard import build_scorecard
from tessera.agent import compile_graph
from tessera.agent.state import new_state
from tessera.settings import LanguageCode

FAILURES_DIR = Path(__file__).parent / "failures"
SCHEMA_PATH = FAILURES_DIR / "_schema.json"
REPORTS_DIR = Path(__file__).parent / "reports"


@dataclass(frozen=True, slots=True)
class CaseResult:
    """The result of running a single failure case in a single language."""

    case_id: str
    language: str
    passed: bool
    reasons: list[str]
    final_response: str
    needs_escalation: bool
    invoked_tools: list[str]


def _load_schema() -> dict[str, object]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _load_cases() -> list[dict[str, object]]:
    schema = _load_schema()
    cases: list[dict[str, object]] = []
    for path in sorted(FAILURES_DIR.glob("[0-9][0-9]_*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        jsonschema.validate(payload, schema)
        cases.append(payload)
    return cases


def _evaluate(
    case: dict[str, object],
    language: str,
    final_state: dict[str, object],
) -> tuple[bool, list[str]]:
    """Return (passed, reasons) for one (case, language) pair."""
    response = str(final_state.get("final_response", ""))
    pass_criteria = case.get("pass_criteria") or {}
    if not isinstance(pass_criteria, dict):
        return False, ["pass_criteria is malformed"]
    reasons: list[str] = []

    must_not = pass_criteria.get("must_not_contain") or []
    if isinstance(must_not, list):
        for needle in must_not:
            if str(needle) in response:
                reasons.append(f"response contained forbidden substring {needle!r}")

    must_any = pass_criteria.get("must_contain_any") or []
    if isinstance(must_any, list) and must_any:
        if not any(str(needle) in response for needle in must_any):
            reasons.append(
                "response did not contain any required substring "
                f"from {must_any!r}"
            )

    if "must_escalate" in pass_criteria:
        expected = bool(pass_criteria["must_escalate"])
        actual = bool(final_state.get("needs_escalation", False))
        if expected != actual:
            reasons.append(
                f"escalation expected={expected}, actual={actual}"
            )

    forbidden_tools = pass_criteria.get("must_not_invoke_tools") or []
    if isinstance(forbidden_tools, list) and forbidden_tools:
        invoked = {call.tool_name for call in final_state.get("tool_calls", [])}
        for forbidden in forbidden_tools:
            if str(forbidden) in invoked:
                reasons.append(f"forbidden tool {forbidden!r} was invoked")

    return not reasons, reasons


async def _run_case(case: dict[str, object], language: str) -> CaseResult:
    prompt_bundle = (case.get("prompts") or {}).get(language)
    if not isinstance(prompt_bundle, dict):
        return CaseResult(
            case_id=str(case["id"]),
            language=language,
            passed=False,
            reasons=[f"no prompt configured for {language!r}"],
            final_response="",
            needs_escalation=False,
            invoked_tools=[],
        )

    user_input = str(prompt_bundle["user"])
    initial = new_state(
        conversation_id=uuid.uuid4(),
        turn_id=uuid.uuid4(),
        user_input=user_input,
        language=LanguageCode(language),
        language_confidence=1.0,
    )
    graph = compile_graph()
    final_state = await graph.ainvoke(initial)
    passed, reasons = _evaluate(case, language, final_state)
    return CaseResult(
        case_id=str(case["id"]),
        language=language,
        passed=passed,
        reasons=reasons,
        final_response=str(final_state.get("final_response", "")),
        needs_escalation=bool(final_state.get("needs_escalation", False)),
        invoked_tools=[call.tool_name for call in final_state.get("tool_calls", [])],
    )


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Tessera failure catalogue.")
    parser.add_argument("--case", help="Run only the case with this id.")
    parser.add_argument("--lang", choices=["fr", "de", "en"], help="Restrict to one language.")
    parser.add_argument(
        "--report",
        type=Path,
        default=REPORTS_DIR / "latest.json",
        help="Where to write the JSON scorecard (default: eval/reports/latest.json).",
    )
    return parser.parse_args(argv)


async def _run_all(args: argparse.Namespace) -> int:
    cases = _load_cases()
    if args.case:
        cases = [c for c in cases if c["id"] == args.case]
        if not cases:
            sys.stderr.write(f"no case with id {args.case!r}\n")
            return 2

    results: list[CaseResult] = []
    for case in cases:
        prompts = case.get("prompts") or {}
        languages = (
            [args.lang] if args.lang else [lang for lang in case["languages"]]
        )
        for language in languages:
            if language not in prompts:
                continue
            result = await _run_case(case, language)
            results.append(result)

    args.report.parent.mkdir(parents=True, exist_ok=True)
    scorecard = build_scorecard(results)
    args.report.write_text(
        json.dumps(
            {"summary": asdict(scorecard.summary), "results": [asdict(r) for r in results]},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    sys.stdout.write(scorecard.render_markdown() + "\n")
    return 0 if scorecard.summary.failed == 0 else 1


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = _parse_args(argv)
    return asyncio.run(_run_all(args))


if __name__ == "__main__":  # pragma: no cover  thin CLI shim
    raise SystemExit(main())
