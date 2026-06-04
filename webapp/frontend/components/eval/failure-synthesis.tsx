import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScorecardResult, Synthesis } from "@/lib/api/schemas";

const KNOWN = new Set([
  "prompt_injection",
  "pii_leak",
  "hallucination",
  "overconfidence",
  "citation_fabrication",
  "tool_misuse",
  "policy_violation",
  "regulatory_misstatement",
  "language_mixing",
  "escalation_failure",
]);

const TONE: Record<string, "danger" | "warning" | "navy" | "info"> = {
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

/** Short, scannable case chip: the numeric prefix, full id on hover. */
function CaseChip({ caseId }: { caseId: string }) {
  const short = caseId.split("_")[0] ?? caseId;
  return (
    <code
      title={caseId}
      className="rounded bg-[var(--muted)]/60 px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--foreground)]"
    >
      {short}
    </code>
  );
}

/**
 * Superadmin-only weakness map. Preferred form is the qualitative `synthesis`
 * (failures grouped into interpretive families with a root-cause note) — hand
 * authored or generated at run time by a capable model. When a run carries no
 * synthesis (older runs), we fall back to a mechanical grouping by category so
 * the panel is never empty.
 */
export async function FailureSynthesis({
  synthesis,
  results,
  locale,
}: {
  synthesis?: Synthesis | null;
  results: ScorecardResult[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "eval" });
  const failed = results.filter((r) => !r.passed);
  const hasSynthesis = (synthesis?.families.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-gold-500" />
          <CardTitle>{t("failureSynthesis.title")}</CardTitle>
          <Badge tone="navy">{t("failureSynthesis.badge")}</Badge>
          {hasSynthesis ? (
            <span className="ml-auto flex items-center gap-1 text-[0.7rem] text-[var(--muted-foreground)]">
              <Sparkles className="h-3 w-3 text-gold-500" />
              {synthesis?.model && synthesis.model !== "manual"
                ? t("failureSynthesis.generatedBy", { model: synthesis.model })
                : t("failureSynthesis.manual")}
            </span>
          ) : null}
        </div>
        <CardDescription>{t("failureSynthesis.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {failed.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            {t("failureSynthesis.none")}
          </div>
        ) : hasSynthesis ? (
          // Preferred: the qualitative, interpretive synthesis.
          <ul className="flex flex-col gap-3">
            {synthesis?.families.map((fam) => (
              <li
                key={fam.label}
                className="flex flex-col gap-1.5 border-[var(--border)] border-l-2 pl-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm text-[var(--foreground)]">{fam.label}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {fam.case_ids.map((id) => (
                      <CaseChip key={id} caseId={id} />
                    ))}
                  </span>
                </div>
                {fam.note ? (
                  <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {fam.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          // Fallback: mechanical grouping by category (runs with no synthesis).
          <FallbackByCategory failed={failed} t={t} />
        )}
      </CardContent>
    </Card>
  );
}

function FallbackByCategory({
  failed,
  t,
}: {
  failed: ScorecardResult[];
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const groups = new Map<string, ScorecardResult[]>();
  for (const r of failed) {
    const key = KNOWN.has(r.category) ? r.category : "unknown";
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <div className="flex flex-col gap-4">
      {ordered.map(([category, items]) => (
        <div key={category} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge tone={TONE[category] ?? "neutral"}>{t(`categories.${category}`)}</Badge>
            <span className="font-medium text-[var(--muted-foreground)] text-xs tabular-nums">
              {items.length} {t("failureSynthesis.casesLabel")}
            </span>
          </div>
          <span className="flex flex-wrap items-center gap-1 pl-1">
            {items.map((r) => (
              <CaseChip key={r.case_id} caseId={r.case_id} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
