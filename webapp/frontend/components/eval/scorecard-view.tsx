import { Check, FileSearch, X } from "lucide-react";
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
import { RunHistoryPanel } from "@/components/eval/run-history-panel";
import { loadAllRuns, loadScorecard } from "@/lib/eval";
import type { ScorecardDocument, ScorecardResult } from "@/lib/api/schemas";

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
      {runs.length > 0 && <RunHistoryPanel runs={runs} currentFile={filename} />}

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
          <SummaryRow
            scorecard={scorecard}
            labels={{
              total: t("summary.total"),
              passed: t("summary.passed"),
              failed: t("summary.failed"),
              rate: t("summary.rate"),
            }}
          />
          {/* Results by category */}
          <ResultsByCategory
            results={scorecard.results}
            columns={{
              case: t("columns.case"),
              language: t("columns.language"),
              result: t("columns.result"),
              expected: t("columns.expected"),
              failureReason: t("columns.failureReason"),
            }}
            passLabel={t("passed")}
            failLabel={t("failed")}
          />
        </>
      )}
    </div>
  );
}

interface SummaryLabels {
  total: string;
  passed: string;
  failed: string;
  rate: string;
}

function SummaryRow({
  scorecard,
  labels,
}: {
  scorecard: ScorecardDocument;
  labels: SummaryLabels;
}) {
  const { summary } = scorecard;
  const passRate = `${(summary.pass_rate * 100).toFixed(0)}%`;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <SummaryTile label={labels.total} value={summary.total} />
      <SummaryTile label={labels.passed} value={summary.passed} tone="success" />
      <SummaryTile label={labels.failed} value={summary.failed} tone="danger" />
      <SummaryTile label={labels.rate} value={passRate} tone="navy" />
    </div>
  );
}

interface CategoryColumns {
  case: string;
  language: string;
  result: string;
  expected: string;
  failureReason: string;
}

function ResultsByCategory({
  results,
  columns,
  passLabel,
  failLabel,
}: {
  results: ScorecardResult[];
  columns: CategoryColumns;
  passLabel: string;
  failLabel: string;
}) {
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
                  <Badge tone={(CATEGORY_TONE[category] as "danger" | "warning" | "navy" | "info") ?? "neutral"}>
                    {CATEGORY_LABELS[category] ?? category}
                  </Badge>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {passed}/{total}
                  </span>
                </div>
                <PassRateBar rate={rate} />
              </div>
              {/* Cases */}
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[35%]" />
                  <col className="w-[28%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>{columns.case}</TableHead>
                    <TableHead className="text-center">{columns.language}</TableHead>
                    <TableHead className="text-center">{columns.result}</TableHead>
                    <TableHead>{columns.expected}</TableHead>
                    <TableHead>{columns.failureReason}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((result) => (
                    <TableRow key={`${result.case_id}-${result.language}`}>
                      <TableCell className="max-w-0 overflow-hidden align-top">
                        <div className="w-full font-mono text-xs leading-[18px]">{result.case_id.replace(/_/g, "_​")}</div>
                        {result.title && (
                          <div className="mt-0.5 w-full break-words text-xs leading-[18px] text-[var(--muted-foreground)]">
                            {result.title}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-center">
                        <Badge tone={result.language === "fr" ? "navy" : result.language === "de" ? "gold" : "info"}>
                          {result.language.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-center">
                        {result.passed ? (
                          <Badge tone="success" className="gap-1">
                            <Check className="h-3 w-3" /> {passLabel}
                          </Badge>
                        ) : (
                          <Badge tone="danger" className="gap-1">
                            <X className="h-3 w-3" /> {failLabel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-0 overflow-hidden align-top text-xs text-[var(--muted-foreground)]">
                        <div className="w-full break-words leading-[18px] text-justify">
                          {result.expected_behavior ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0 overflow-hidden align-top">
                        {result.reasons.length > 0 ? (
                          <ul className="w-full space-y-1">
                            {result.reasons.map((r, i) => (
                              <li key={i} className="break-words text-xs leading-[18px] text-justify text-red-600 dark:text-red-400">
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
  const gradient =
    pct >= 80
      ? "bg-gradient-to-r from-green-600 to-green-400"
      : pct >= 50
        ? "bg-gradient-to-r from-amber-600 to-amber-400"
        : "bg-gradient-to-r from-red-600 to-red-400";
  const text =
    pct >= 80
      ? "text-green-700 dark:text-green-400"
      : pct >= 50
        ? "text-amber-700 dark:text-amber-400"
        : "text-red-700 dark:text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
        <div className={`h-full ${gradient} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-8 text-right text-xs font-semibold tabular-nums ${text}`}>{pct}%</span>
    </div>
  );
}

interface SummaryTileProps {
  label: string;
  value: number | string;
  tone?: "success" | "danger" | "navy";
}

function SummaryTile({ label, value, tone }: SummaryTileProps) {
  const valueColor =
    tone === "success"
      ? "text-green-700 dark:text-green-400"
      : tone === "danger"
        ? "text-red-700 dark:text-red-400"
        : tone === "navy"
          ? "text-navy-900 dark:text-gold-400"
          : "text-[var(--foreground)]";
  const topBorder =
    tone === "success"
      ? "border-t-2 border-t-green-500"
      : tone === "danger"
        ? "border-t-2 border-t-red-500"
        : tone === "navy"
          ? "border-t-2 border-t-gold-500"
          : "";
  return (
    <Card className={topBorder}>
      <CardContent className="flex flex-col items-center gap-1 py-5">
        <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
        <span className={`font-serif text-3xl font-semibold tabular-nums ${valueColor}`}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}
