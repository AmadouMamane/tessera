import { AlertTriangle, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScorecardResult } from "@/lib/api/schemas";

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

/**
 * Superadmin-only weakness map: the selected run's failures grouped by family,
 * each with its failing cases and the grader's reason. This is the most
 * sensitive eval surface (a precise list of the deployment's weak spots), so it
 * sits above the operator per-case table and is gated one level higher.
 */
export async function FailureSynthesis({
  results,
  locale,
}: {
  results: ScorecardResult[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "eval" });
  const failed = results.filter((r) => !r.passed);

  const groups = new Map<string, ScorecardResult[]>();
  for (const r of failed) {
    const key = KNOWN.has(r.category) ? r.category : "unknown";
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-gold-500" />
          <CardTitle>{t("failureSynthesis.title")}</CardTitle>
          <Badge tone="navy">{t("failureSynthesis.badge")}</Badge>
        </div>
        <CardDescription>{t("failureSynthesis.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {failed.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            {t("failureSynthesis.none")}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {ordered.map(([category, items]) => (
              <div key={category} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Badge tone={TONE[category] ?? "neutral"}>{t(`categories.${category}`)}</Badge>
                  <span className="text-xs font-medium tabular-nums text-[var(--muted-foreground)]">
                    {items.length} {t("failureSynthesis.casesLabel")}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 pl-1">
                  {items.map((r) => (
                    <li key={r.case_id} className="text-xs leading-relaxed">
                      <code className="rounded bg-[var(--muted)]/50 px-1 py-0.5 text-[var(--foreground)]">
                        {r.case_id}
                      </code>
                      {r.reasons.length > 0 ? (
                        <span className="text-[var(--muted-foreground)]">
                          {" "}
                          — {r.reasons.join(" ; ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
