/**
 * Server-side proxy for the backend read endpoints (audit, healthz, readyz,
 * budget). A next.config rewrite cannot inject the Authorization header, so we
 * proxy here instead and attach the service-to-service bearer token.
 *
 * The more specific `app/api/chat/route.ts` takes precedence over this
 * catch-all, so POST /api/chat is unaffected.
 */
import { type NextRequest, NextResponse } from "next/server";

import { backendHeaders, backendUrl } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
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
