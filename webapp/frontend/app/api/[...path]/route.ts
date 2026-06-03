/**
 * Server-side proxy for the backend read endpoints (audit, healthz, readyz,
 * budget). A next.config rewrite cannot inject the Authorization header, so we
 * proxy here instead and attach the service-to-service bearer token.
 *
 * The more specific `app/api/chat/route.ts` takes precedence over this
 * catch-all, so POST /api/chat is unaffected.
 *
 * Security: this proxy authenticates on the caller's behalf, so it must NOT be
 * a wildcard — that would make every authenticated agent GET endpoint anonymously
 * reachable through the public front. We allowlist by first path segment and
 * close the operator surfaces (audit/budget — they expose the compliance trail
 * and cost counters) on the public deployment via TESSERA_DASHBOARD_PUBLIC=1.
 * Locally the flag is unset, so the operator keeps the full dashboard.
 */
import { type NextRequest, NextResponse } from "next/server";

import { backendHeaders, backendUrl } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALWAYS_PUBLIC = new Set(["healthz", "readyz"]);
const OPERATOR_ONLY = new Set(["audit", "budget"]);

function isProxyAllowed(head: string): boolean {
  if (ALWAYS_PUBLIC.has(head)) return true;
  if (OPERATOR_ONLY.has(head)) return process.env.TESSERA_DASHBOARD_PUBLIC !== "1";
  return false; // unknown path → never proxied (no wildcard)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  if (!isProxyAllowed(path[0] ?? "")) {
    return NextResponse.json({ detail: "not found" }, { status: 404 });
  }
  const target = `${backendUrl()}/${path.join("/")}${request.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "GET",
      headers: backendHeaders({
        Accept: request.headers.get("accept") ?? "application/json",
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "backend unreachable" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(upstream.body, { status: upstream.status, headers });
}
