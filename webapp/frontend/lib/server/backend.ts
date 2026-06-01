/**
 * Server-only helpers for talking to the FastAPI backend.
 *
 * The bearer token is a service-to-service secret: it authenticates the Next
 * server (a trusted proxy) to the backend and MUST NOT reach the browser. It is
 * read from a non-`NEXT_PUBLIC_` env var and only ever used inside route
 * handlers (which always run on the server). Do not import this module from a
 * Client Component.
 */

/** Base URL of the FastAPI backend. Injected per environment. */
export function backendUrl(): string {
  return process.env.TESSERA_BACKEND_URL ?? "http://localhost:8099";
}

/**
 * Build outbound headers for a backend call, injecting the shared bearer token
 * when configured. Extra headers (Content-Type, X-Session-Id, …) are merged.
 */
export function backendHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = process.env.TESSERA_BACKEND_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
