// Entry point: reads the environment (docs/deployment.md) and serves rooms until SIGTERM.

import { createGameServer } from "./game-server";

const port = Number(process.env.PORT ?? 8080);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
/** How long games in progress may run on after SIGTERM (docs/deployment.md). */
const DRAIN_MS = 60_000;

const server = createGameServer({ allowedOrigins });
const bound = await server.listen(port);
console.log(`chibi-bluff server on :${bound} (origins: ${allowedOrigins.join(", ")})`);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: no new rooms, waiting for ${server.playing()} game(s)…`);
  server.beginShutdown();
  const until = Date.now() + DRAIN_MS;
  while (server.playing() > 0 && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 1_000));
  }
  await server.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
