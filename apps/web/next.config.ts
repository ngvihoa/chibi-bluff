import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end tests build into a separate folder so they never disturb a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Lets a second "player" open the dev server as 127.0.0.1 (its own localStorage) to try rooms.
  allowedDevOrigins: ["127.0.0.1"],
  // The service worker must never be cached, so a new deploy reaches players at once (§6.1).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace packages ship TypeScript sources (see their package.json "exports").
  transpilePackages: [
    "@chibi-bluff/engine",
    "@chibi-bluff/bots",
    "@chibi-bluff/match",
    "@chibi-bluff/protocol",
    "@chibi-bluff/themes",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
