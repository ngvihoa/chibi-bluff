import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end tests build into a separate folder so they never disturb a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Lets a second "player" open the dev server as 127.0.0.1 (its own localStorage) to try rooms.
  allowedDevOrigins: ["127.0.0.1"],
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
