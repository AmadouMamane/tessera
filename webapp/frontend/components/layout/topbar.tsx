"use client";

import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { StatusBadge } from "@/components/layout/status-badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface TopbarProps {
  title: string;
  description?: string;
}

export function Topbar({ title, description }: TopbarProps) {
  const t = useTranslations("app");
  return (
    <header className="relative flex min-h-[5.5rem] items-center border-b border-[var(--border)] bg-[var(--background)]/80 px-8 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/60">
      {/* premium gold hairline under the topbar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent" />
      {/* left — live status badge */}
      <div className="flex flex-1 items-center">
        <StatusBadge />
      </div>
      {/* centered title */}
      <div className="flex flex-col items-center text-center">
        <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("tagline")}</p>
        )}
      </div>
      {/* right controls */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
