/**
 * Route handler for POST /api/chat.
 *
 * Proxies the request to the FastAPI backend and streams the SSE response
 * back to the browser. Using a route handler instead of a next.config rewrite
 * is required for SSE: the rewrite layer buffers the full response before
 * forwarding, which breaks streaming for long LLM calls.
 */
import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.TESSERA_BACKEND_URL ?? "http://localhost:8080";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text();

  const upstream = await fetch(`${BACKEND}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { detail: `upstream error ${upstream.status}` },
      { status: upstream.status },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
