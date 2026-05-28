/**
 * Root layout.
 *
 * Intentionally minimal: the [locale]/layout file owns the <html lang>
 * attribute. We keep this file because Next.js requires a root layout, even
 * when every reachable route is locale-prefixed.
 */
import type { ReactNode } from "react";

import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

export const metadata = {
  title: {
    default: "Tessera",
    template: "%s — Tessera",
  },
  description:
    "Multilingual (FR/DE/EN) banking support LLM agent, grounded in EU regulatory corpora.",
  applicationName: "Tessera",
  robots: { index: false, follow: false },
};
