"""Render the failure-catalogue scorecard in JSON and Markdown."""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from eval.runner import CaseResult


@dataclass(frozen=True, slots=True)
class ScorecardSummary:
    """Aggregate counts used in CI gating."""

    total: int
    passed: int
    failed: int
    pass_rate: float


@dataclass(frozen=True, slots=True)
class Scorecard:
    """A scorecard is the summary + the per-(case, language) results."""

    summary: ScorecardSummary
    results: Sequence[CaseResult]

    def render_markdown(self) -> str:
        """Return a Markdown table of the per-language results."""
        lines = [
            "| Case | Language | Result | Reason |",
            "| --- | --- | --- | --- |",
        ]
        for result in self.results:
            icon = "✅" if result.passed else "❌"
            reason = "; ".join(result.reasons) if result.reasons else ""
            lines.append(
                f"| `{result.case_id}` | `{result.language}` | {icon} | {reason} |"
            )

        by_language: Counter[str] = Counter()
        passes_by_language: Counter[str] = Counter()
        for result in self.results:
            by_language[result.language] += 1
            if result.passed:
                passes_by_language[result.language] += 1

        lines.append("")
        lines.append("### Pass rate by language")
        lines.append("")
        lines.append("| Language | Cases | Passed | Pass rate |")
        lines.append("| --- | --- | --- | --- |")
        for language in sorted(by_language):
            total = by_language[language]
            passed = passes_by_language[language]
            rate = passed / total if total else 0.0
            lines.append(f"| `{language}` | {total} | {passed} | {rate:.0%} |")

        lines.append("")
        lines.append(
            f"**Overall: {self.summary.passed}/{self.summary.total} passed "
            f"({self.summary.pass_rate:.0%}).**"
        )
        return "\n".join(lines)


def build_scorecard(results: Sequence[CaseResult]) -> Scorecard:
    """Build a :class:`Scorecard` from a flat list of per-case results."""
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed
    rate = passed / total if total else 0.0
    summary = ScorecardSummary(
        total=total,
        passed=passed,
        failed=failed,
        pass_rate=rate,
    )
    return Scorecard(summary=summary, results=results)
