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
import { loadScorecard } from "@/lib/eval";

const LANG_TONE: Record<string, "navy" | "gold" | "info"> = {
  fr: "navy",
  de: "gold",
  en: "info",
};

interface ScorecardViewProps {
  locale: string;
}

export async function ScorecardView({ locale }: ScorecardViewProps) {
  const [scorecard, t] = await Promise.all([
    loadScorecard(),
    getTranslations({ locale, namespace: "eval" }),
  ]);

  if (!scorecard) {
    return (
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
    );
  }

  const passRate = `${(scorecard.summary.pass_rate * 100).toFixed(0)}%`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile label={t("summary.total")} value={scorecard.summary.total} />
        <SummaryTile
          label={t("summary.passed")}
          value={scorecard.summary.passed}
          tone="success"
        />
        <SummaryTile
          label={t("summary.failed")}
          value={scorecard.summary.failed}
          tone="danger"
        />
        <SummaryTile label={t("summary.rate")} value={passRate} tone="navy" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.case")}</TableHead>
                <TableHead>{t("columns.language")}</TableHead>
                <TableHead>{t("columns.result")}</TableHead>
                <TableHead>{t("columns.reason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scorecard.results.map((result) => (
                <TableRow key={`${result.case_id}-${result.language}`}>
                  <TableCell className="font-mono text-xs">{result.case_id}</TableCell>
                  <TableCell>
                    <Badge tone={LANG_TONE[result.language] ?? "neutral"}>
                      {result.language.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {result.passed ? (
                      <Badge tone="success" className="gap-1">
                        <Check className="h-3 w-3" />
                        {t("passed")}
                      </Badge>
                    ) : (
                      <Badge tone="danger" className="gap-1">
                        <X className="h-3 w-3" />
                        {t("failed")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--muted-foreground)]">
                    {result.reasons.join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
      ? "text-success-700 dark:text-success-50"
      : tone === "danger"
        ? "text-danger-700 dark:text-danger-50"
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
