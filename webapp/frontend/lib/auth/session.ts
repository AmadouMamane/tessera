/**
 * Server-side session/role helpers (ADR 0009).
 *
 * Read the operator role from the Auth.js JWT session and decide who may see
 * the operator surfaces (audit, budget, per-case eval detail). Both `admin` and
 * `auditor` are operators; only `admin` may reach the settings surface.
 */
import "server-only";

import { auth } from "@/auth";
import type { Role } from "@/lib/auth/accounts";

export async function currentRole(): Promise<Role | null> {
  const session = await auth();
  return session?.user?.role ?? null;
}

export function isOperator(role: Role | null): boolean {
  return role === "admin" || role === "auditor";
}

export function isAdmin(role: Role | null): boolean {
  return role === "admin";
}
