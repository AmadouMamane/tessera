import { Check, Cpu, Scale, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScorecardResult } from "@/lib/api/schemas";
import type { ModelRun } from "@/lib/eval";
import { findModel } from "@/lib/models";

/**
 * Side-by-side comparison of the latest run per model (e.g. Llama vs Gemma):
 * two pass-rate columns plus a per-case table, with disagreements highlighted.
 * Renders nothing unless at least two model-tagged runs exist.
 */
export async function ModelComparison({
  runs,
  locale,
}: {
  runs: ModelRun[];
  locale: string;
}) {
  const a = runs[0];
  const b = runs[1];
  if (!a || !b) return null;

  const t = await getTranslations({ locale, namespace: "eval" });

  const indexA = new Map(a.doc.results.map((r) => [r.case_id, r] as const));
  const indexB = new Map(b.doc.results.map((r) => [r.case_id, r] as const));
  const caseIds = [...new Set([...indexA.keys(), ...indexB.keys()])].sort();
  const disagreements = caseIds.filter(
    (id) => indexA.get(id)?.passed !== indexB.get(id)?.passed,
  ).length;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-gradient-to-b from-[var(--muted)]/40 to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-gold-500" />
            <span className="font-medium text-[var(--foreground)]">{t("compareTitle")}</span>
          </div>
          {disagreements > 0 ? (
            <Badge tone="warning">
              {disagreements} {t("compareDisagreements")}
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
          <ModelSummary run={a} />
          <ModelSummary run={b} />
        </div>

        <Table className="table-fixed border-t border-[var(--border)]">
          <colgroup>
            <col className="w-[56%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.case")}</TableHead>
              <TableHead className="text-center">{findModel(a.model).label}</TableHead>
              <TableHead className="text-center">{findModel(b.model).label}</TableHead>
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
      </CardContent>
    </Card>
  );
}

function ModelSummary({ run }: { run: ModelRun }) {
  const { summary } = run.doc;
  const pct = Math.round(summary.pass_rate * 100);
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
        <Cpu className="h-3.5 w-3.5 text-gold-500" /> {findModel(run.model).label}
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
