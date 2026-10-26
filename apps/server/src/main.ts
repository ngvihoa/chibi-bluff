// Entry point: reads the environment (docs/deployment.md) and serves rooms until SIGTERM.

import { createGameServer } from "./game-server";

const port = Number(process.env.PORT ?? 8080);
/** Without ALLOWED_ORIGINS (local development), any localhost port may connect. */
const allowedOrigins: (string | RegExp)[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/];
/** How long games in progress may run on after SIGTERM (docs/deployment.md). */
const DRAIN_MS = 60_000;

/** Testing knobs (e2e): shorter stand-in wait, faster bots. Unset in production. */
const optional = (name: string) => (process.env[name] ? Number(process.env[name]) : undefined);
const server = createGameServer({
  allowedOrigins,
  standInMs: optional("STANDIN_MS"),
  speed: optional("GAME_SPEED"),
});
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
