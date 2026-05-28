import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral:
          "border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)]",
        navy:
          "border-navy-200 bg-navy-50 text-navy-800 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-100",
        gold:
          "border-gold-300 bg-gold-50 text-gold-800 dark:border-gold-700 dark:bg-gold-900/40 dark:text-gold-200",
        success:
          "border-success-500/30 bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-50",
        warning:
          "border-warning-500/30 bg-warning-50 text-warning-700 dark:bg-warning-700/20 dark:text-warning-50",
        danger:
          "border-danger-500/30 bg-danger-50 text-danger-700 dark:bg-danger-700/20 dark:text-danger-50",
        info:
          "border-info-500/30 bg-info-50 text-info-700 dark:bg-info-700/20 dark:text-info-50",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
