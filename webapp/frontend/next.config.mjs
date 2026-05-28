import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Standalone output is required by the Dockerfile.frontend multi-stage build.
  output: "standalone",

  experimental: {
    typedRoutes: true,
    optimizePackageImports: ["lucide-react", "@radix-ui/react-dialog"],
  },

  // Forward /api/* and /chat to the FastAPI backend in dev. Override
  // NEXT_PUBLIC_API_BASE_URL in production via env.
  async rewrites() {
    const apiBase = process.env.TESSERA_BACKEND_URL ?? "http://localhost:8080";
    return [
      // /api/chat is handled by app/api/chat/route.ts (SSE streaming requires a route handler, not a rewrite).
      { source: "/api/audit/:path*", destination: `${apiBase}/audit/:path*` },
      { source: "/api/audit", destination: `${apiBase}/audit` },
      { source: "/api/healthz", destination: `${apiBase}/healthz` },
      { source: "/api/readyz", destination: `${apiBase}/readyz` },
      { source: "/api/budget", destination: `${apiBase}/budget` },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
