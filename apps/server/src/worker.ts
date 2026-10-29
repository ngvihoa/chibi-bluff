// The Worker in front of the rooms (docs/architecture.md §5.5): a thin router.
//   POST /rooms            create a room → { code, seatId, sessionToken }
//   GET  /rooms/<code>/ws  the room's WebSocket (handed to its Durable Object)
//   GET  /healthz          200

import { parseClientMessage, roomCodeSchema } from "@chibi-bluff/protocol";
import type { Env } from "./env";
import { newRoomCode } from "./ids";

export { RoomObject } from "./room-object";

/** Without ALLOWED_ORIGINS (local development), any localhost port may connect. */
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const CODE_ATTEMPTS = 5;

/** Browsers always send Origin; other clients (tests, tools) may not, and are let through. */
function originAllowed(origin: string | null, env: Env): boolean {
  if (origin === null) return true;
  const allowed = env.ALLOWED_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed?.length ? allowed.includes(origin) : LOCAL.test(origin);
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (!originAllowed(origin, env)) return new Response("Origin not allowed", { status: 403 });
    const cors: HeadersInit = origin
      ? { "access-control-allow-origin": origin, vary: "Origin" }
      : {};

    if (url.pathname === "/healthz") return json({ ok: true }, 200, cors);

    if (url.pathname === "/rooms") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            ...cors,
            "access-control-allow-methods": "POST",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
          },
        });
      }
      if (request.method !== "POST") return new Response(null, { status: 405 });
      const body = await request.json().catch(() => null);
      const parsed = parseClientMessage("room:create", body);
      if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400, cors);
      // Codes are random; on the rare clash with an open room, draw another.
      for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
        const code = newRoomCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        const created = await room.create(code, parsed.data);
        if (created) return json(created, 200, cors);
      }
      return json({ ok: false, error: "SERVER_UNREACHABLE" }, 503, cors);
    }

    const ws = url.pathname.match(/^\/rooms\/([^/]+)\/ws$/);
    if (ws) {
      const code = roomCodeSchema.safeParse(ws[1]);
      if (!code.success) return new Response("Bad room code", { status: 400 });
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426 });
      }
      return env.ROOMS.get(env.ROOMS.idFromName(code.data)).fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
