"use client";

import { type ReactNode, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Segmented switch between the run detail and the model comparison, so clicking
 * a run in the history immediately updates the visible detail (the comparison
 * no longer pushes it off-screen). When there is nothing to compare (<2
 * model-tagged runs) the toggle is hidden and only the detail is shown.
 */
export function EvalTabs({
  detail,
  compare,
  labels,
}: {
  detail: ReactNode;
  compare: ReactNode | null;
  labels: { detail: string; compare: string };
}) {
  const [view, setView] = useState<"detail" | "compare">("detail");

  if (!compare) return <>{detail}</>;

  const tabs = [
    { key: "detail" as const, label: labels.detail },
    { key: "compare" as const, label: labels.compare },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex self-start rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={view === tab.key}
            onClick={() => setView(tab.key)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              view === tab.key
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{view === "detail" ? detail : compare}</div>
    </div>
  );
}
