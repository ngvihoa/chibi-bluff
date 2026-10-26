import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end tests build into a separate folder so they never disturb a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace packages ship TypeScript sources (see their package.json "exports").
  transpilePackages: [
    "@chibi-bluff/engine",
    "@chibi-bluff/bots",
    "@chibi-bluff/match",
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
