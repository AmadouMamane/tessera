import { ArrowRight, Award, Cpu } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { RunMeta } from "@/lib/api/schemas";
import { findModel } from "@/lib/models";

/**
 * Hero callout pinning the best-scoring run to the top of the eval page, so the
 * first impression is the flagship result — not whichever run happens to be the
 * most recent. Clicking it selects that run (?run=…). The full per-model spread
 * (including weaker models) stays honestly visible in the history below.
 */
export async function BestRunHighlight({ run, locale }: { run: RunMeta; locale: string }) {
  const t = await getTranslations({ locale, namespace: "eval" });
  const pct = Math.round(run.summary.pass_rate * 100);
  const model = run.model ? findModel(run.model).label : "—";

  return (
    <Link href={`?run=${run.filename}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/[0.08] via-[var(--card)] to-[var(--card)] p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-500/50 hover:shadow-[var(--shadow-card-elevated)] dark:from-gold-500/[0.12]">
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-serif text-3xl font-semibold tabular-nums text-navy-900 dark:text-gold-400">
                {pct}%
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {run.summary.passed}/{run.summary.total}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gold-500" />
          </div>
        </div>
      </div>
    </Link>
  );
}
