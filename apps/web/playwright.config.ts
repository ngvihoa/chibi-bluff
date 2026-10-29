import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Game server for the online tests: shorter stand-in wait and fast bots (apps/server). */
const SERVER_PORT = 8180;

/**
 * End-to-end tests against a production build (`pnpm e2e` from the repo root).
 * Uses the locally installed Google Chrome, so no browser download is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    channel: "chrome",
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // Separate build folder: running e2e next to `pnpm dev` must not disturb the dev server.
      command: `NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_GAME_SERVER_URL=http://127.0.0.1:${SERVER_PORT} pnpm build && NEXT_DIST_DIR=.next-e2e pnpm exec next start -p ${PORT}`,
      url: `http://localhost:${PORT}/vi`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The Cloudflare Worker and its Durable Objects, run locally by wrangler.
      command: `pnpm --filter @chibi-bluff/server exec wrangler dev --port ${SERVER_PORT} --ip 127.0.0.1 --var STANDIN_MS:2000 --var GAME_SPEED:0.1`,
      url: `http://127.0.0.1:${SERVER_PORT}/healthz`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
