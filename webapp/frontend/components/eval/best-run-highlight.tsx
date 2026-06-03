import { Award, Cpu } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { RunMeta } from "@/lib/api/schemas";
import { findModel } from "@/lib/models";

/**
 * Hero banner pinning the best-scoring run to the top of the eval page, so the
 * first impression is the flagship result — not whichever run is most recent.
 *
 * Intentionally NOT a link: the page already defaults to this run (its summary
 * and detail render right below), so a "view this run" click would be a no-op.
 * Run-to-run navigation lives in the history table beneath.
 */
export async function BestRunHighlight({ run, locale }: { run: RunMeta; locale: string }) {
  const t = await getTranslations({ locale, namespace: "eval" });
  const pct = Math.round(run.summary.pass_rate * 100);
  const model = run.model ? findModel(run.model).label : "—";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/[0.08] via-[var(--card)] to-[var(--card)] p-5 shadow-sm dark:from-gold-500/[0.12]">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-gold-400 ring-1 ring-gold-500/25 dark:bg-gold-500 dark:text-navy-950">
            <Award className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium uppercase tracking-wider text-gold-700 dark:text-gold-400">
              {t("bestRun")}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
              <Cpu className="h-3.5 w-3.5 text-gold-500" />
              {model}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-3xl font-semibold tabular-nums text-navy-900 dark:text-gold-400">
            {pct}%
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">
            {run.summary.passed}/{run.summary.total}
          </div>
        </div>
      </div>
    </div>
  );
}
