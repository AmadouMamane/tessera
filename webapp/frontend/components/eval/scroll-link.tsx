"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A Link that also scrolls to the run detail (#run-detail) on every click —
 * including re-clicking the run that is already selected — but never on page
 * load or refresh (it is driven by the click, not by the ?run= search param).
 * Replaces the previous effect-on-param-change approach, which auto-scrolled on
 * refresh and did nothing when re-clicking the same run.
 */
export function ScrollLink({
  href,
  className,
  title,
  children,
  "aria-label": ariaLabel,
}: {
  href: Route;
  className?: string;
  title?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={() =>
        document
          .getElementById("run-detail")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    >
      {children}
    </Link>
  );
}
