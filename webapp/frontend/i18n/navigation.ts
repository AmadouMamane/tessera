/**
 * Locale-aware navigation primitives.
 *
 * Components should import `Link`, `redirect`, `usePathname`, and `useRouter`
 * from this module instead of `next/navigation` so that the locale segment
 * is propagated automatically.
 */
import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
