/**
 * Auth.js route handlers (sign-in / callback / session / sign-out).
 *
 * This specific route takes precedence over the `app/api/[...path]` catch-all,
 * so the auth endpoints are never proxied to the agent.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
