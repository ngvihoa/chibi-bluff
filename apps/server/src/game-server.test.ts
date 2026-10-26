// Integration tests: a real server on a random port, driven by socket.io-client.

import type { PlayerInput } from "@chibi-bluff/engine";
import {
  type AckFor,
  type ClientMessageName,
  type ClientToServerEvents,
  PROTOCOL_VERSION,
  type ServerMessageName,
  type ServerMessages,
  type ServerToClientEvents,
} from "@chibi-bluff/protocol";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGameServer, type GameServer, type GameServerOptions } from "./game-server";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const v = PROTOCOL_VERSION;

let server: GameServer;
let url: string;
const clients: Client[] = [];

async function boot(options: Partial<GameServerOptions> = {}) {
  server = createGameServer({ allowedOrigins: ["http://localhost"], speed: 0.02, ...options });
  url = `http://localhost:${await server.listen(0)}`;
}

function client(): Client {
  const socket: Client = connect(url, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  return socket;
}

function call<N extends ClientMessageName>(
  socket: Client,
  name: N,
  payload: unknown = {},
): Promise<AckFor<N>> {
  const emit = socket.emit.bind(socket) as (
    event: string,
    payload: unknown,
    ack: (reply: AckFor<N>) => void,
  ) => void;
  return new Promise((resolve) => emit(name, payload, resolve));
}

/** The next message of a kind (optionally one that matches). */
function next<N extends ServerMessageName>(
  socket: Client,
  name: N,
  match: (payload: ServerMessages[N]) => boolean = () => true,
  timeoutMs = 5_000,
): Promise<ServerMessages[N]> {
  const on = socket.on.bind(socket) as (e: string, l: (p: ServerMessages[N]) => void) => void;
  const off = socket.off.bind(socket) as (e: string, l: (p: ServerMessages[N]) => void) => void;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${name} in ${timeoutMs}ms`)), timeoutMs);
    const listener = (payload: ServerMessages[N]) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      off(name, listener);
      resolve(payload);
    };
    on(name, listener);
  });
}

async function created(socket: Client, name = "Chủ") {
  const ack = await call(socket, "room:create", { protocolVersion: v, name, locale: "vi" });
  if (!ack.ok) throw new Error(ack.error);
  return ack;
}
async function joined(socket: Client, code: string, name = "Khách", sessionToken?: string) {
  const ack = await call(socket, "room:join", { protocolVersion: v, code, name, sessionToken });
  if (!ack.ok) throw new Error(ack.error);
  return ack;
}

/**
 * Plays whatever is legal as soon as it is offered: pass, Income, or the first option. Bots run
 * 50× faster than real, so this can outpace the input rate limit; then it retries with the
 * latest options (a real player never acts this fast).
 */
function autoplay(socket: Client) {
  const errors: string[] = [];
  let latest: PlayerInput[] = [];
  const pick = (legal: PlayerInput[]) =>
    legal.find((i) => i.type === "PASS") ??
    legal.find((i) => i.type === "DECLARE" && i.action === "income") ??
    legal[0];
  const play = () => {
    const input = pick(latest);
    if (!input) return;
    void call(socket, "game:input", { input }).then((r) => {
      if (r.ok) return;
      errors.push(r.error);
      if (r.error === "RATE_LIMITED") setTimeout(play, 150);
    });
  };
  const offered = ({ legal }: { legal: PlayerInput[] }) => {
    latest = legal;
    play();
  };
  socket.on("game:sync", offered);
  socket.on("game:update", offered);
  return errors;
}

beforeEach(async () => {
  await boot();
});
afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server.close();
});

describe("rooms", () => {
  it("creates a room, lets a guest in, and shows everyone the same seats", async () => {
    const host = client();
    const hostState = next(host, "room:state");
    const { code, seatId } = await created(host);
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect((await hostState).you).toBe(seatId);

    const guest = client();
    const seen = next(host, "room:state", (s) => s.seats.length === 2);
    const mine = next(guest, "room:state");
    await joined(guest, code.toLowerCase());
    const [h, g] = await Promise.all([seen, mine]);
    expect(h.seats.map((s) => s.name)).toEqual(["Chủ", "Khách"]);
    expect(g.seats).toEqual(h.seats);
    expect(JSON.stringify([h, g])).not.toMatch(/token/i);
  });

  it("refuses unknown rooms, old clients and malformed messages", async () => {
    const socket = client();
    expect(
      await call(socket, "room:join", { protocolVersion: v, code: "ZZZZZ", name: "A" }),
    ).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    expect(await call(socket, "room:create", { protocolVersion: 0, name: "A" })).toEqual({
      ok: false,
      error: "VERSION_MISMATCH",
    });
    expect(await call(socket, "room:create", { protocolVersion: v })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
    expect(await call(socket, "room:start")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
  });

  it("keeps lobby powers with the host and names bots from the theme", async () => {
    const host = client();
    const { code } = await created(host);
    const guest = client();
    await joined(guest, code);
    expect(await call(guest, "room:addBot")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(await call(guest, "room:start")).toEqual({ ok: false, error: "NOT_HOST" });
    const withBot = next(guest, "room:state", (s) => s.seats.length === 3);
    expect(await call(host, "room:addBot")).toEqual({ ok: true });
    const bot = (await withBot).seats[2];
    expect(bot?.kind).toBe("bot");
    expect(bot?.name).toMatch(/\S/);
    const fast = next(guest, "room:state", (s) => s.settings.pace === "fast");
    expect(await call(host, "room:settings", { settings: { pace: "fast" } })).toEqual({ ok: true });
    await fast;
    expect(await call(host, "room:settings", { settings: { actionTimeoutSeconds: 300 } })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
  });

  it("kicks a guest out of the room", async () => {
    const host = client();
    const { code } = await created(host);
    const guest = client();
    const { seatId } = await joined(guest, code);
    const kicked = next(guest, "room:kicked");
    expect(await call(host, "room:kick", { seatId })).toEqual({ ok: true });
    await kicked;
    expect(await call(guest, "room:settings", { settings: {} })).toEqual({
      ok: false,
      error: "NOT_IN_ROOM",
    });
  });

  it("frees a lobby seat whose browser does not come back, and closes empty rooms", async () => {
    await server.close();
    await boot({ lobbyGraceMs: 100 });
    const host = client();
    const { code } = await created(host);
    const guest = client();
    await joined(guest, code);
    const gone = next(host, "room:state", (s) => s.seats.length === 1, 2_000);
    guest.disconnect();
    await gone;
    expect(server.rooms()).toBe(1);
    await call(host, "room:leave");
    expect(server.rooms()).toBe(0);
    expect(await call(client(), "room:join", { protocolVersion: v, code, name: "A" })).toEqual({
      ok: false,
      error: "ROOM_NOT_FOUND",
    });
  });

  it("rate-limits a flood of messages", async () => {
    const host = client();
    await created(host);
    const replies = await Promise.all(
      Array.from({ length: 30 }, () => call(host, "room:settings", { settings: {} })),
    );
    expect(replies.some((r) => !r.ok && r.error === "RATE_LIMITED")).toBe(true);
  });

  it("answers the health check", async () => {
    const host = client();
    await created(host);
    const res = await fetch(`${url}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, rooms: 1, closing: false });
  });
});

describe("games", () => {
  it("shows each seat only its own cards", async () => {
    const host = client();
    const { code, seatId: hostId } = await created(host);
    const guest = client();
    const { seatId: guestId } = await joined(guest, code);
    const syncs = Promise.all([next(host, "game:sync"), next(guest, "game:sync")]);
    expect(await call(host, "room:start")).toEqual({ ok: true });
    const [h, g] = await syncs;
    for (const [sync, me] of [
      [h, hostId],
      [g, guestId],
    ] as const) {
      expect(sync.view.viewerId).toBe(me);
      for (const p of sync.view.players) {
        for (const card of p.cards) {
          if (p.id === me) expect(card.role).not.toBeNull();
          else expect(card.role).toBeNull();
        }
      }
    }
  });

  it("plays a whole game with people and a bot, then marks the room finished", async () => {
    const host = client();
    const { code } = await created(host);
    const guest = client();
    await joined(guest, code);
    await call(host, "room:addBot");
    const errors = [autoplay(host), autoplay(guest)];
    const finished = next(host, "room:state", (s) => s.status === "finished", 30_000);
    expect(await call(host, "room:start")).toEqual({ ok: true });
    await finished.catch((e) => {
      throw new Error(`${e}; input errors: ${errors.flat().join(", ")}`);
    });
    expect(server.playing()).toBe(0);
  }, 40_000);

  it("ignores the seat a client claims and checks inputs with the engine", async () => {
    const host = client();
    const { code } = await created(host);
    const guest = client();
    const { seatId: guestId } = await joined(guest, code);
    const sync = next(host, "game:sync");
    await call(host, "room:start");
    const { view } = await sync;
    const actor = view.turn.actorId;
    const notActing = actor === guestId ? host : guest;
    // Pretending to be the acting seat does not work: the input counts as the sender's own.
    const reply = await call(notActing, "game:input", {
      input: { type: "DECLARE", playerId: actor, action: "income" },
    });
    expect(reply).toEqual({ ok: false, error: "NOT_YOUR_TURN" });
    expect(await call(guest, "game:input", { input: { type: "TIMEOUT" } })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
  });

  it("lets a player reconnect mid-game with their token and catch up", async () => {
    const host = client();
    const { code } = await created(host);
    const guest = client();
    const { seatId, sessionToken } = await joined(guest, code);
    const started = next(guest, "game:sync");
    await call(host, "room:start");
    await started;
    const dropped = next(host, "room:state", (s) => s.seats[1]?.connected === false);
    guest.disconnect();
    await dropped;

    const again = client();
    const caughtUp = next(again, "game:sync");
    const back = await joined(again, code, "ignored", sessionToken);
    expect(back).toMatchObject({ seatId, sessionToken });
    const sync = await caughtUp;
    expect(sync.view.viewerId).toBe(seatId);
    expect(sync.log[0]?.type).toBe("GAME_STARTED");
    expect(await call(again, "chat:sticker", { sticker: "duke" })).toEqual({ ok: true });
  });

  it("refuses new rooms while shutting down", async () => {
    const watcher = client();
    await created(watcher);
    const notice = next(watcher, "server:closing");
    server.beginShutdown();
    await notice;
    expect(await call(client(), "room:create", { protocolVersion: v, name: "A" })).toEqual({
      ok: false,
      error: "SERVER_CLOSING",
    });
  });
});
