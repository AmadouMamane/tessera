/**
 * Locale negotiation middleware.
 *
 * Runs on every request and either redirects to a locale-prefixed URL or
 * rewrites internally so that the negotiated locale reaches the App Router.
 */
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths except Next internals, static assets, and the /api proxy.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
