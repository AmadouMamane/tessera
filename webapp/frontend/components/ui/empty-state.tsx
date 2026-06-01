import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 text-gold-400 shadow-[inset_0_1px_1px_oklch(0.7_0.13_195/0.2),0_8px_24px_-8px_oklch(0.7_0.13_195/0.3)] ring-1 ring-gold-500/15 dark:from-gold-500/15 dark:to-gold-500/5 dark:ring-gold-400/20 [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      ) : null}
      <p className="font-medium text-sm text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-[var(--muted-foreground)]">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
