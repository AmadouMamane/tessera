import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-[linear-gradient(110deg,var(--secondary)_8%,var(--muted)_18%,var(--secondary)_33%)]",
        "bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
