/**
 * Locked-surface placeholder shown to non-operators (ADR 0009). Renders a
 * sign-in call to action linking to the locale-prefixed login page.
 */
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export async function OperatorLocked({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "auth" });
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          <Lock className="h-6 w-6" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="font-serif text-lg font-semibold">{t("locked.title")}</h3>
          <p className="text-sm text-[var(--muted-foreground)]">{t("locked.description")}</p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-gold-400 shadow-sm transition-colors hover:bg-navy-800 dark:bg-gold-500 dark:text-navy-950 dark:hover:bg-gold-400"
        >
          {t("locked.cta")}
        </Link>
      </CardContent>
    </Card>
  );
}
