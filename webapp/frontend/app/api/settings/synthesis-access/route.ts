/**
 * Superadmin-gated write for the "admin may see the synthesis" grant.
 *
 * The enforcement lives here (the front holds the identity); the agent persists
 * the flag without its own role check. Mirrors the read in
 * `lib/server/settings.ts` and the proxy model in `app/api/[...path]/route.ts`.
 */
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { backendHeaders, backendUrl } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const role = (await auth())?.user?.role;
  if (role !== "superadmin") {
    return NextResponse.json({ detail: "superadmin only" }, { status: 403 });
  }
  try {
    const upstream = await fetch(`${backendUrl()}/settings/synthesis-admin`, {
      headers: backendHeaders({ Accept: "application/json" }),
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({ enabled: false }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "backend unreachable" },
      { status: 502 },
    );
  }
}

export async function PUT(request: NextRequest): Promise<Response> {
  const role = (await auth())?.user?.role;
  if (role !== "superadmin") {
    return NextResponse.json({ detail: "superadmin only" }, { status: 403 });
  }

  let enabled = false;
  try {
    const body = (await request.json()) as { enabled?: unknown };
    enabled = Boolean(body?.enabled);
  } catch {
    enabled = false;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/settings/synthesis-admin`, {
      method: "PUT",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ enabled }),
    });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "backend unreachable" },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({ enabled }));
  return NextResponse.json(data, { status: upstream.status });
}
