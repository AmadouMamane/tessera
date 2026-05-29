import { Check, ChevronDown, ChevronRight, FileSearch, TrendingUp, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadAllRuns, loadScorecard } from "@/lib/eval";
import type { RunMeta, ScorecardDocument, ScorecardResult } from "@/lib/api/schemas";

const CATEGORY_LABELS: Record<string, string> = {
  prompt_injection: "Prompt Injection",
  pii_leak: "PII Leak",
  hallucination: "Hallucination",
  overconfidence: "Overconfidence",
  citation_fabrication: "Citation Fabrication",
  tool_misuse: "Tool Misuse",
  policy_violation: "Policy Violation",
  regulatory_misstatement: "Regulatory Misstatement",
  language_mixing: "Language Mixing",
  escalation_failure: "Escalation Failure",
};

const CATEGORY_TONE: Record<string, string> = {
  prompt_injection: "danger",
  pii_leak: "danger",
  hallucination: "warning",
  overconfidence: "warning",
  citation_fabrication: "warning",
  tool_misuse: "danger",
  policy_violation: "navy",
  regulatory_misstatement: "navy",
  language_mixing: "info",
  escalation_failure: "danger",
};

interface ScorecardViewProps {
  locale: string;
  filename?: string;
}

export async function ScorecardView({ locale, filename }: ScorecardViewProps) {
  const [scorecard, runs, t] = await Promise.all([
    loadScorecard(filename),
    loadAllRuns(),
    getTranslations({ locale, namespace: "eval" }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Evolution history */}
      {runs.length > 0 && <EvolutionPanel runs={runs} currentFile={filename} />}

      {!scorecard ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<FileSearch />}
              title={t("title")}
              description={t("description")}
            />
            <div className="mt-6 rounded-md bg-[var(--muted)]/40 p-4 font-mono text-xs leading-relaxed text-[var(--muted-foreground)]">
              $ uv run python scripts/run_eval.py
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary tiles */}
          <SummaryRow scorecard={scorecard} />
          {/* Results by category */}
          <ResultsByCategory results={scorecard.results} />
        </>
      )}
    </div>
  );
}

function SummaryRow({ scorecard }: { scorecard: ScorecardDocument }) {
  const { summary } = scorecard;
  const passRate = `${(summary.pass_rate * 100).toFixed(0)}%`;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <SummaryTile label="Total" value={summary.total} />
      <SummaryTile label="Passed" value={summary.passed} tone="success" />
      <SummaryTile label="Failed" value={summary.failed} tone="danger" />
      <SummaryTile label="Pass rate" value={passRate} tone="navy" />
    </div>
  );
}

function EvolutionPanel({ runs, currentFile }: { runs: RunMeta[]; currentFile?: string }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
          <TrendingUp className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium">Run history</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>Passed</TableHead>
                <TableHead>Pass rate</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run, idx) => {
                const prev = runs[idx + 1];
                const delta = prev
                  ? run.summary.pass_rate - prev.summary.pass_rate
                  : null;
                const isCurrent = !currentFile
                  ? idx === 0
                  : run.filename === currentFile;
                return (
                  <TableRow
                    key={run.filename}
                    className={isCurrent ? "bg-[var(--muted)]/30" : ""}
                  >
                    <TableCell className="font-mono text-xs">
                      {formatRunAt(run.run_at)}
                      {isCurrent && (
                        <Badge tone="info" className="ml-2 text-[10px]">current</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral">{run.lang?.toUpperCase() ?? "ALL"}</Badge>
                    </TableCell>
                    <TableCell>{run.summary.total}</TableCell>
                    <TableCell>{run.summary.passed}</TableCell>
                    <TableCell className="font-semibold">
                      {(run.summary.pass_rate * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      {delta !== null ? (
                        <span
                          className={
                            delta > 0
                              ? "text-green-600 dark:text-green-400"
                              : delta < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-[var(--muted-foreground)]"
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {(delta * 100).toFixed(0)}pp
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsByCategory({ results }: { results: ScorecardResult[] }) {
  const byCategory = groupBy(results, (r) => r.category || "other");
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(byCategory).map(([category, items]) => {
        const passed = items.filter((r) => r.passed).length;
        const total = items.length;
        const rate = total ? passed / total : 0;
        return (
          <Card key={category}>
            <CardContent className="p-0">
              {/* Category header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                <div className="flex items-center gap-3">
                  <Badge tone={(CATEGORY_TONE[category] as any) ?? "neutral"}>
                    {CATEGORY_LABELS[category] ?? category}
                  </Badge>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {passed}/{total} passed
                  </span>
                </div>
                <PassRateBar rate={rate} />
              </div>
              {/* Cases */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Failure reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((result) => (
                    <TableRow key={`${result.case_id}-${result.language}`}>
                      <TableCell>
                        <div className="font-mono text-xs">{result.case_id}</div>
                        {result.title && (
                          <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                            {result.title}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge tone={result.language === "fr" ? "navy" : result.language === "de" ? "gold" : "info"}>
                          {result.language.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {result.passed ? (
                          <Badge tone="success" className="gap-1">
                            <Check className="h-3 w-3" /> Pass
                          </Badge>
                        ) : (
                          <Badge tone="danger" className="gap-1">
                            <X className="h-3 w-3" /> Fail
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-[var(--muted-foreground)]">
                        {result.expected_behavior
                          ? result.expected_behavior.slice(0, 100) +
                            (result.expected_behavior.length > 100 ? "…" : "")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {result.reasons.length > 0 ? (
                          <ul className="space-y-1">
                            {result.reasons.map((r, i) => (
                              <li key={i} className="text-xs text-red-600 dark:text-red-400">
                                {r}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PassRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold">{pct}%</span>
    </div>
  );
}

interface SummaryTileProps {
  label: string;
  value: number | string;
  tone?: "success" | "danger" | "navy";
}

function SummaryTile({ label, value, tone }: SummaryTileProps) {
  const accent =
    tone === "success"
      ? "text-green-700 dark:text-green-400"
      : tone === "danger"
        ? "text-red-700 dark:text-red-400"
        : tone === "navy"
          ? "text-navy-900 dark:text-gold-400"
          : "text-[var(--foreground)]";
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-5">
        <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
        <span className={`font-serif text-3xl font-semibold ${accent}`}>{value}</span>
      </CardContent>
    </Card>
  );
}

function formatRunAt(raw: string): string {
  // 20260529T092300Z → 2026-05-29 09:23
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!m) return raw;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}
