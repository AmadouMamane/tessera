"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Smoothly scrolls to the run detail (#run-detail) whenever the selected run
 * changes via ?run=… — i.e. when the user clicks a row in the run history or
 * the best-run banner. Does nothing on the default landing (no ?run param), so
 * the page still opens at the top with the banner and history in view.
 */
export function RunDetailScroller() {
  const run = useSearchParams().get("run");
  useEffect(() => {
    if (!run) return;
    document.getElementById("run-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [run]);
  return null;
}
