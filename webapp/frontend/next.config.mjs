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

  // All backend calls are proxied by server-side route handlers under
  // app/api/* (chat/route.ts for SSE, [...path]/route.ts for the read
  // endpoints) so the bearer token can be injected — a rewrite cannot add an
  // Authorization header. The backend URL is read from TESSERA_BACKEND_URL.

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
