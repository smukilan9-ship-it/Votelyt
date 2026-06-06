import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root — there are multiple lockfiles on this machine and
  // Turbopack otherwise infers the wrong one (~/package-lock.json).
  turbopack: {
    root: projectRoot,
  },
  // Baseline security headers on every response. Intentionally no strict CSP:
  // the UI relies on inline styles (framer-motion), data: image URLs (base64
  // candidate photos), blob: URLs (CSV export) and an external HLS video — a
  // tight CSP would break those. CSP is tracked as future hardening.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
