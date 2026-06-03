"use client";

import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Topbar auth affordance (ADR 0009): a sign-in link for visitors, or the
 * current role badge plus a sign-out button for operators.
 */
export function AuthControl() {
  const { data: session, status } = useSession();
  const t = useTranslations("auth");
  const router = useRouter();
  const role = session?.user?.role;

  if (status === "loading") return null;

  if (!role) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
      >
        <LogIn className="h-3.5 w-3.5" />
        {t("auditorMode")}
      </Link>
    );
  }

  async function onSignOut() {
    await signOut({ redirect: false });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
          "bg-gold-500/15 text-gold-700 ring-1 ring-gold-500/25 dark:text-gold-300",
        )}
      >
        <ShieldCheck className="h-3 w-3" />
        {t(`roles.${role}`)}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
      >
        <LogOut className="h-3.5 w-3.5" />
        {t("signOut")}
      </button>
    </div>
  );
}
