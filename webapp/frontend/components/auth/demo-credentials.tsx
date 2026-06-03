/**
 * Demo-credentials panel for the login page (ADR 0009).
 *
 * The demo intentionally surfaces the seeded operator credentials so any
 * visitor can explore the gated surfaces — the gate is theatrical by design.
 * Reads the credentials server-side from the same source as the auth provider.
 */
import { KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { demoCredentials } from "@/lib/auth/accounts";

export async function DemoCredentials({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "auth" });
  const tRoles = await getTranslations({ locale, namespace: "auth.roles" });
  const creds = demoCredentials();

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/40 p-4">
      <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
        <KeyRound className="h-3.5 w-3.5 text-gold-500" />
        {t("demo.title")}
      </div>
      <p className="mb-3 text-[0.7rem] text-[var(--muted-foreground)]/80">{t("demo.hint")}</p>
      <ul className="flex flex-col gap-1.5">
        {creds.map((c) => (
          <li
            key={c.username}
            className="flex items-center justify-between gap-3 rounded-md bg-[var(--card)] px-3 py-1.5 font-mono text-xs"
          >
            <span className="text-[var(--foreground)]">
              {c.username} <span className="text-[var(--muted-foreground)]">/</span> {c.password}
            </span>
            <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[0.65rem] text-[var(--muted-foreground)]">
              {tRoles(c.role)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
