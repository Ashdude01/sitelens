import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker / VPS deploys.
  output: "standalone",
  // Native / heavy server packages are loaded from node_modules at runtime instead of being bundled.
  serverExternalPackages: ["postgres", "playwright-core", "undici", "@resvg/resvg-js"],
  // Runtime data files read with fs (fingerprints, calibration, migrations) must ship with the standalone build.
  outputFileTracingIncludes: {
    "/**": ["./data/fingerprints/**", "./data/fonts/**", "./data/calibration.json", "./drizzle/**"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
