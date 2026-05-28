"use client";

import { Activity, FileSearch, MessageSquareText, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

interface NavItem {
  href: "/chat" | "/audit" | "/eval" | "/health";
  icon: LucideIcon;
  labelKey: "chat" | "audit" | "eval" | "health";
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/chat",   icon: MessageSquareText, labelKey: "chat" },
  { href: "/audit",  icon: ShieldCheck,        labelKey: "audit" },
  { href: "/eval",   icon: FileSearch,         labelKey: "eval" },
  { href: "/health", icon: Activity,           labelKey: "health" },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      <BrandHeader />
      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-navy-900 text-navy-50 dark:bg-gold-500 dark:text-navy-950"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active
                        ? "text-gold-400 dark:text-navy-950"
                        : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
                    )}
                  />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <SidebarFooter />
    </aside>
  );
}

function BrandHeader() {
  const t = useTranslations("app");
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
      <div
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-md bg-navy-900 font-serif text-base font-semibold text-gold-400 dark:bg-gold-500 dark:text-navy-950"
      >
        T
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-serif text-base font-semibold tracking-tight text-[var(--foreground)]">
          {t("title")}
        </span>
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">
          {t("subtitle")}
        </span>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-[var(--border)] px-4 py-3">
      <p className="text-[0.7rem] leading-relaxed text-[var(--muted-foreground)]">
        Crédit Aurore — démo non destinée
        <br />à la production. Données fictives.
      </p>
    </div>
  );
}
