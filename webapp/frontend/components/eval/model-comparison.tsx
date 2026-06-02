import { Check, Cpu, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScorecardDocument, ScorecardResult } from "@/lib/api/schemas";
import { shortRunDate } from "@/lib/format";
import { findModel } from "@/lib/models";

export interface CompareRun {
  model: string | null;
  run_at?: string | null;
  doc: ScorecardDocument;
}

function runLabel(run: CompareRun): string {
  const base = run.model ? findModel(run.model).label : "Run";
  const date = shortRunDate(run.run_at);
  return date ? `${base} · ${date}` : base;
}

/**
 * Side-by-side comparison of two explicitly chosen runs (A vs B): two pass-rate
 * columns plus a per-case table, disagreements highlighted. The two runs are
 * picked by the user via CompareControls (URL ?run=A&vs=B).
 */
export async function ModelComparison({
  a,
  b,
  locale,
}: {
  a: CompareRun;
  b: CompareRun;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "eval" });

  const indexA = new Map(a.doc.results.map((r) => [r.case_id, r] as const));
  const indexB = new Map(b.doc.results.map((r) => [r.case_id, r] as const));
  const caseIds = [...new Set([...indexA.keys(), ...indexB.keys()])].sort();
  const disagreements = caseIds.filter(
    (id) => indexA.get(id)?.passed !== indexB.get(id)?.passed,
  ).length;

  const labelA = runLabel(a);
  const labelB = runLabel(b);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]/55 shadow-sm">
      {disagreements > 0 ? (
        <div className="flex items-center justify-end border-b border-[var(--border)] bg-gradient-to-b from-[var(--muted)]/40 to-transparent px-5 py-2.5">
          <Badge tone="warning">
            {disagreements} {t("compareDisagreements")}
          </Badge>
        </div>
      ) : null}

      <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
        <ModelSummary run={a} label={labelA} />
        <ModelSummary run={b} label={labelB} />
      </div>

      <Table className="table-fixed border-t border-[var(--border)]">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[33%]" />
          <col className="w-[33%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.case")}</TableHead>
            <TableHead className="text-center">{labelA}</TableHead>
            <TableHead className="text-center">{labelB}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {caseIds.map((id) => {
            const ra = indexA.get(id);
            const rb = indexB.get(id);
            const disagree = ra?.passed !== rb?.passed;
            return (
              <TableRow key={id} className={disagree ? "bg-amber-500/[0.07]" : undefined}>
                <TableCell className="max-w-0 overflow-hidden align-top">
                  <div className="w-full font-mono text-xs leading-[18px]">
                    {id.replace(/_/g, "_​")}
                  </div>
                </TableCell>
                <TableCell className="align-top text-center">
                  <ResultMark result={ra} />
                </TableCell>
                <TableCell className="align-top text-center">
                  <ResultMark result={rb} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ModelSummary({ run, label }: { run: CompareRun; label: string }) {
  const { summary } = run.doc;
  const pct = Math.round(summary.pass_rate * 100);
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
        <Cpu className="h-3.5 w-3.5 text-gold-500" /> {label}
      </span>
      <span className="font-serif text-3xl font-semibold tabular-nums text-navy-900 dark:text-gold-400">
        {pct}%
      </span>
      <span className="text-xs text-[var(--muted-foreground)]">
        {summary.passed}/{summary.total}
      </span>
    </div>
  );
}

function ResultMark({ result }: { result?: ScorecardResult }) {
  if (!result) return <span className="text-xs text-[var(--muted-foreground)]">—</span>;
  return result.passed ? (
    <Badge tone="success" className="gap-1">
      <Check className="h-3 w-3" />
    </Badge>
  ) : (
    <Badge tone="danger" className="gap-1">
      <X className="h-3 w-3" />
    </Badge>
  );
}
