"""Compare two regression-eval reports side by side (e.g. Llama vs Gemma).

Reads two JSON reports produced by ``eval.runner`` and emits a Markdown
comparison: a summary line per model plus a per-case table with each model's
pass/fail and the failure reasons. Useful to judge a model swap at a glance.

Usage::

    uv run python scripts/compare_eval.py eval/reports/llama_fr.json \
        eval/reports/gemma_fr.json --labels Llama Gemma \
        --out eval/reports/compare_llama_gemma_fr.md
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def _load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _index(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Map ``case_id`` → result row."""
    return {str(r["case_id"]): r for r in report.get("results", [])}


def _summary_line(label: str, report: dict[str, Any]) -> str:
    s = report.get("summary", {})
    total = s.get("total", 0)
    passed = s.get("passed", 0)
    rate = s.get("pass_rate", 0.0)
    return f"- **{label}** ({report.get('run_at', '?')}): {passed}/{total} passed ({rate:.0%})"


def build_markdown(
    label_a: str,
    report_a: dict[str, Any],
    label_b: str,
    report_b: dict[str, Any],
) -> str:
    idx_a = _index(report_a)
    idx_b = _index(report_b)
    case_ids = sorted(set(idx_a) | set(idx_b))

    lines: list[str] = []
    lines.append(f"# Eval comparison — {label_a} vs {label_b}\n")
    lines.append(_summary_line(label_a, report_a))
    lines.append(_summary_line(label_b, report_b))
    lines.append("")

    # Cases where the two models disagree, surfaced first.
    def status(row: dict[str, Any] | None) -> str:
        if row is None:
            return "—"
        return "✅" if row.get("passed") else "❌"

    disagreements = [cid for cid in case_ids if status(idx_a.get(cid)) != status(idx_b.get(cid))]
    if disagreements:
        lines.append(f"**Disagreements ({len(disagreements)}):** " + ", ".join(disagreements))
        lines.append("")

    lines.append(f"| Case | {label_a} | {label_b} | Failure reason (failing model) |")
    lines.append("| --- | :---: | :---: | --- |")
    for cid in case_ids:
        ra, rb = idx_a.get(cid), idx_b.get(cid)
        reason = ""
        for row in (ra, rb):
            if row is not None and not row.get("passed") and row.get("reasons"):
                reason = "; ".join(str(x) for x in row["reasons"])[:160]
                break
        lines.append(f"| {cid} | {status(ra)} | {status(rb)} | {reason} |")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Side-by-side compare two eval reports.")
    parser.add_argument("report_a", type=Path)
    parser.add_argument("report_b", type=Path)
    parser.add_argument(
        "--labels",
        nargs=2,
        default=["A", "B"],
        metavar=("LABEL_A", "LABEL_B"),
        help="Display names for the two reports.",
    )
    parser.add_argument("--out", type=Path, help="Write the Markdown here (also prints to stdout).")
    args = parser.parse_args(argv)

    report_a = _load(args.report_a)
    report_b = _load(args.report_b)
    md = build_markdown(args.labels[0], report_a, args.labels[1], report_b)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(md, encoding="utf-8")
        sys.stdout.write(f"Comparison written → {args.out}\n")
    sys.stdout.write(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
