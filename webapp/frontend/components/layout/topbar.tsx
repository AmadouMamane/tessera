"use client";

import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface TopbarProps {
  title: string;
  description?: string;
}

export function Topbar({ title, description }: TopbarProps) {
  const t = useTranslations("app");
  return (
    <header className="flex items-center justify-between gap-6 border-b border-[var(--border)] bg-[var(--background)]/80 px-8 py-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/60">
      <div className="flex flex-col">
        <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("tagline")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
