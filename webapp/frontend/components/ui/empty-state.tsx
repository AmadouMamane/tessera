import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-[var(--muted-foreground)] [&_svg]:size-8">
          {icon}
        </div>
      ) : null}
      <p className="font-medium text-sm text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-[var(--muted-foreground)]">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
