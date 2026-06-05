import { FileSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { OperatorLocked } from "@/components/auth/operator-locked";
import { BestRunHighlight } from "@/components/eval/best-run-highlight";
import { CompareControls } from "@/components/eval/compare-controls";
import { EvalTabs } from "@/components/eval/eval-tabs";
import { FailureSynthesis } from "@/components/eval/failure-synthesis";
import { ModelComparison } from "@/components/eval/model-comparison";
import { ResultsByCategory } from "@/components/eval/results-by-category";
import { RunHistoryPanel } from "@/components/eval/run-history-panel";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ScorecardDocument } from "@/lib/api/schemas";
import { currentRole, isOperator, isSuperadmin } from "@/lib/auth/session";
import { loadAllRuns, loadScorecard } from "@/lib/eval";

interface ScorecardViewProps {
  locale: string;
  filename?: string;
  vs?: string;
}

export async function ScorecardView({ locale, filename, vs }: ScorecardViewProps) {
  const [runs, t] = await Promise.all([
    loadAllRuns(),
    getTranslations({ locale, namespace: "eval" }),
  ]);

  // Aggregate scores stay public (showcase); the per-case detail — case status
  // and failure reasons, i.e. a map of the live deployment's weaknesses — is an
  // operator surface (ADR 0009).
  const role = await currentRole();
  const operator = isOperator(role);
  const superadmin = isSuperadmin(role);

  // Default the landing to the best-scoring run of the CURRENT catalogue (the
  // version of the most recent run), so the headline isn't a high score from a
  // smaller/older catalogue. Older-catalogue runs stay visible (and badged) in
  // the history. Falls back to all runs when no version is stamped.
  const currentVersion = runs[0]?.catalogue_version ?? null;
  const currentRuns = currentVersion
    ? runs.filter((r) => r.catalogue_version === currentVersion)
    : runs;
  const bestRun = currentRuns.length
    ? currentRuns.reduce((best, r) => (r.summary.pass_rate > best.summary.pass_rate ? r : best))
    : null;

  // Comparison = run A (the viewed run) vs run B (user-picked via ?vs=). Both
  // are selectable; B defaults to the latest run of a different model.
  const aFile = filename ?? bestRun?.filename;
  const scorecard = await loadScorecard(aFile);
  const aModel = scorecard?.model ?? null;
  const bFile =
    vs ??
    runs.find((r) => r.model && r.model !== aModel && r.filename !== aFile)?.filename ??
    runs.find((r) => r.filename !== aFile)?.filename;
  const bScorecard = operator && bFile ? await loadScorecard(bFile) : null;
  const comparePair =
    scorecard && bScorecard
      ? {
          a: { model: scorecard.model ?? null, run_at: scorecard.run_at ?? null, doc: scorecard },
          b: {
            model: bScorecard.model ?? null,
            run_at: bScorecard.run_at ?? null,
            doc: bScorecard,
          },
        }
      : null;

  const detail = (
    <div className="flex flex-col gap-6">
      {/* Best run pinned to the top so the first impression is the flagship score */}
      {bestRun && <BestRunHighlight run={bestRun} locale={locale} />}

      {/* Evolution history (per-run model badges) */}
      {runs.length > 0 && <RunHistoryPanel runs={runs} currentFile={aFile} />}

      {/* Selecting a run (history row or best-run banner) scrolls here, via ScrollLink. */}
      <div id="run-detail" className="flex scroll-mt-4 flex-col gap-6">
        {!scorecard ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState icon={<FileSearch />} title={t("title")} description={t("description")} />
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
            {/* Failure synthesis — superadmin-only weakness map (above the table) */}
            {superadmin ? (
              <FailureSynthesis
                synthesis={scorecard.synthesis}
                results={scorecard.results}
                locale={locale}
              />
            ) : null}
            {/* Results by category — operator surface (failure reasons) */}
            {operator ? (
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
                filterLabels={{
                  all: t("resultFilter.all"),
                  failed: t("resultFilter.failed"),
                  passed: t("resultFilter.passed"),
                  empty: t("resultFilter.empty"),
                }}
              />
            ) : (
              <OperatorLocked locale={locale} />
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <EvalTabs
      detail={detail}
      compare={
        // The comparison renders a per-case pass/fail table — same sensitivity
        // as the detail — so it is operator-only. For visitors `compare` is null
        // and EvalTabs hides the toggle entirely.
        operator && comparePair ? (
          <div className="flex flex-col gap-5 pb-10">
            <CompareControls
              runs={runs}
              aFile={aFile}
              bFile={bFile}
              labels={{ a: t("compareRunA"), b: t("compareRunB") }}
            />
            <ModelComparison a={comparePair.a} b={comparePair.b} locale={locale} />
          </div>
        ) : null
      }
      labels={{ detail: t("viewRun"), compare: t("viewCompare") }}
    />
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
  const accent =
    tone === "success"
      ? "from-green-500/70"
      : tone === "danger"
        ? "from-red-500/70"
        : tone === "navy"
          ? "from-gold-500/70"
          : "from-[var(--border)]";
  const glow =
    tone === "success"
      ? "bg-green-500/[0.07]"
      : tone === "danger"
        ? "bg-red-500/[0.07]"
        : tone === "navy"
          ? "bg-gold-500/[0.08]"
          : "bg-transparent";
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-elevated)]">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent} via-transparent to-transparent`}
      />
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${glow}`}
      />
      <CardContent className="flex flex-col items-center gap-1.5 py-6">
        <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
        <span className={`font-serif text-4xl font-semibold tabular-nums ${valueColor}`}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
