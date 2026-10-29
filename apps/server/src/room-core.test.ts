// RoomCore driven by fake connections: every frame goes through JSON, as on a real WebSocket.

import type { PlayerInput } from "@chibi-bluff/engine";
import {
  type Ack,
  PROTOCOL_VERSION,
  type ServerFrame,
  type ServerMessageName,
  type ServerMessages,
} from "@chibi-bluff/protocol";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Connection,
  RoomCore,
  type RoomCoreOptions,
  type RoomHooks,
  type RoomSnapshot,
} from "./room-core";

const v = PROTOCOL_VERSION;
const CODE = "ABCDE";

class Client {
  readonly connection: Connection;
  closed = false;
  private readonly listeners = new Set<(frame: ServerFrame) => void>();
  private nextId = 1;

  constructor(private readonly core: RoomCore) {
    this.connection = {
      send: (frame) => {
        const copy = JSON.parse(JSON.stringify(frame)) as ServerFrame;
        for (const listener of [...this.listeners]) listener(copy);
      },
      close: () => {
        this.closed = true;
      },
    };
    core.connect(this.connection);
  }

  /** Sends a frame with an id and returns the reply (the core answers synchronously). */
  call(type: string, payload: unknown = {}): Ack<Record<string, unknown>> {
    const id = this.nextId++;
    let reply: Ack<Record<string, unknown>> | undefined;
    const off = this.listen((f) => {
      if ("re" in f && f.re === id) reply = f.reply as Ack<Record<string, unknown>>;
    });
    this.raw(JSON.stringify({ id, type, payload }));
    off();
    if (!reply) throw new Error(`no reply to ${type}`);
    return reply;
  }

  raw(text: string) {
    this.core.receive(this.connection, text);
  }

  /** The next message of a kind (optionally one that matches). */
  next<N extends ServerMessageName>(
    type: N,
    match: (payload: ServerMessages[N]) => boolean = () => true,
    timeoutMs = 5_000,
  ): Promise<ServerMessages[N]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`no ${type} in ${timeoutMs}ms`));
      }, timeoutMs);
      const off = this.listen((f) => {
        if (!("type" in f) || f.type !== type) return;
        const payload = f.payload as ServerMessages[N];
        if (!match(payload)) return;
        clearTimeout(timer);
        off();
        resolve(payload);
      });
    });
  }

  listen(listener: (frame: ServerFrame) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The tab closes or the network drops. */
  drop() {
    this.core.disconnect(this.connection);
  }
}

const cores: RoomCore[] = [];
afterEach(() => {
  for (const core of cores.splice(0)) core.dispose();
});

/** A room created over HTTP, with its host already connected and seated. */
function hosted(options: RoomCoreOptions = {}, hooks: RoomHooks = {}) {
  const core = new RoomCore({ speed: 0.02, ...options }, hooks);
  cores.push(core);
  const created = core.create(CODE, { protocolVersion: v, name: "Chủ", locale: "vi" });
  if (!created?.ok) throw new Error("create failed");
  const host = new Client(core);
  const joined = host.call("room:join", {
    protocolVersion: v,
    code: CODE,
    name: "Chủ",
    sessionToken: created.sessionToken,
  });
  expect(joined).toMatchObject({ ok: true, seatId: created.seatId });
  return { core, host, hostId: created.seatId };
}

function join(core: RoomCore, name = "Khách", sessionToken?: string) {
  const client = new Client(core);
  const reply = client.call("room:join", { protocolVersion: v, code: CODE, name, sessionToken });
  if (!reply.ok) throw new Error(reply.error);
  return { client, seatId: reply.seatId as string, sessionToken: reply.sessionToken as string };
}

/**
 * Plays whatever is legal as soon as it is offered: pass, Income, or the first option. Bots run
 * 50× faster than real, so this can outpace the input rate limit; then it retries with the
 * latest options (a real player never acts this fast).
 */
function autoplay(client: Client) {
  const errors: string[] = [];
  let latest: PlayerInput[] = [];
  const pick = () =>
    latest.find((i) => i.type === "PASS") ??
    latest.find((i) => i.type === "DECLARE" && i.action === "income") ??
    latest[0];
  const play = () => {
    const input = pick();
    if (!input) return;
    const reply = client.call("game:input", { input });
    if (reply.ok) return;
    errors.push(reply.error);
    if (reply.error === "RATE_LIMITED") setTimeout(play, 150);
  };
  client.listen((f) => {
    if ("type" in f && (f.type === "game:sync" || f.type === "game:update")) {
      latest = f.payload.legal;
      // Answer after the current frame is handled, as a real client would.
      queueMicrotask(play);
    }
  });
  return errors;
}

describe("rooms", () => {
  it("lets the host in with the token from POST /rooms, then a guest", async () => {
    const { core, host, hostId } = hosted();
    expect(core.create(CODE, { protocolVersion: v, name: "Other" })).toBeNull(); // code taken
    const seen = host.next("room:state", (s) => s.seats.length === 2);
    const guest = new Client(core);
    const mine = guest.next("room:state");
    const reply = guest.call("room:join", { protocolVersion: v, code: "abcde", name: "Khách" });
    expect(reply).toMatchObject({ ok: true, code: CODE });
    const [h, g] = await Promise.all([seen, mine]);
    expect(h.you).toBe(hostId);
    expect(h.seats.map((s) => s.name)).toEqual(["Chủ", "Khách"]);
    expect(h.seats.every((s) => s.connected)).toBe(true);
    expect(g.seats).toEqual(h.seats);
    expect(JSON.stringify([h, g])).not.toMatch(/token/i);
  });

  it("refuses unknown rooms, old clients and malformed frames", () => {
    const { core } = hosted();
    const client = new Client(core);
    expect(client.call("room:join", { protocolVersion: v, code: "ZZZZZ", name: "A" })).toEqual({
      ok: false,
      error: "ROOM_NOT_FOUND",
    });
    expect(client.call("room:join", { protocolVersion: 1, code: CODE, name: "A" })).toEqual({
      ok: false,
      error: "VERSION_MISMATCH",
    });
    expect(client.call("room:join", { protocolVersion: v })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
    // Creating happens over HTTP only; unknown types are refused.
    expect(client.call("room:create", { protocolVersion: v, name: "A" })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
    expect(client.call("nonsense")).toEqual({ ok: false, error: "BAD_REQUEST" });
    expect(client.call("room:start")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    // Garbage and oversized frames are dropped without breaking the connection.
    const replies: ServerFrame[] = [];
    client.listen((f) => replies.push(f));
    client.raw("not json");
    client.raw(JSON.stringify({ id: 99, type: "room:leave", payload: "x".repeat(5_000) }));
    expect(replies).toEqual([]);
    expect(client.call("room:start")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
  });

  it("answers pings", () => {
    const { host } = hosted();
    const pong = host.next("pong");
    host.raw(JSON.stringify({ type: "ping" }));
    return expect(pong).resolves.toEqual({});
  });

  it("keeps lobby powers with the host and names bots from the theme", async () => {
    const { core, host } = hosted();
    const { client: guest } = join(core);
    expect(guest.call("room:addBot")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(guest.call("room:start")).toEqual({ ok: false, error: "NOT_HOST" });
    const withBot = guest.next("room:state", (s) => s.seats.length === 3);
    expect(host.call("room:addBot")).toEqual({ ok: true });
    const bot = (await withBot).seats[2];
    expect(bot?.kind).toBe("bot");
    expect(bot?.name).toMatch(/\S/);
    const fast = guest.next("room:state", (s) => s.settings.pace === "fast");
    expect(host.call("room:settings", { settings: { pace: "fast" } })).toEqual({ ok: true });
    await fast;
    expect(host.call("room:settings", { settings: { actionTimeoutSeconds: 300 } })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
  });

  it("kicks a guest out of the room", async () => {
    const { core, host } = hosted();
    const { client: guest, seatId } = join(core);
    const kicked = guest.next("room:kicked");
    expect(host.call("room:kick", { seatId })).toEqual({ ok: true });
    await kicked;
    expect(guest.call("room:settings", { settings: {} })).toEqual({
      ok: false,
      error: "NOT_IN_ROOM",
    });
  });

  it("frees a lobby seat whose browser does not come back, and closes empty rooms", async () => {
    const { core, host } = hosted({ lobbyGraceMs: 100 });
    const { client: guest } = join(core);
    const gone = host.next("room:state", (s) => s.seats.length === 1, 2_000);
    guest.drop();
    await gone;
    expect(core.isOpen).toBe(true);
    host.call("room:leave");
    expect(core.isOpen).toBe(false);
    expect(
      new Client(core).call("room:join", { protocolVersion: v, code: CODE, name: "A" }),
    ).toEqual({
      ok: false,
      error: "ROOM_NOT_FOUND",
    });
  });

  it("closes a room whose creator never connects", async () => {
    const core = new RoomCore({ lobbyGraceMs: 50 });
    cores.push(core);
    core.create(CODE, { protocolVersion: v, name: "Ghost" });
    expect(core.isOpen).toBe(true);
    await new Promise((r) => setTimeout(r, 120));
    expect(core.isOpen).toBe(false);
  });

  it("gives a seat to the newest tab and closes the older one", () => {
    const { core } = hosted();
    const { client: first, seatId, sessionToken } = join(core);
    const second = new Client(core);
    const reply = second.call("room:join", {
      protocolVersion: v,
      code: CODE,
      name: "x",
      sessionToken,
    });
    expect(reply).toEqual({ ok: true, code: CODE, seatId, sessionToken });
    expect(first.closed).toBe(true);
    expect(first.call("room:settings", { settings: {} })).toEqual({
      ok: false,
      error: "NOT_IN_ROOM",
    });
  });

  it("rate-limits a flood of messages", () => {
    const { host } = hosted();
    const replies = Array.from({ length: 30 }, () => host.call("room:settings", { settings: {} }));
    expect(replies.some((r) => !r.ok && r.error === "RATE_LIMITED")).toBe(true);
  });
});

describe("games", () => {
  it("shows each seat only its own cards", async () => {
    const { core, host, hostId } = hosted();
    const { client: guest, seatId: guestId } = join(core);
    const syncs = Promise.all([host.next("game:sync"), guest.next("game:sync")]);
    expect(host.call("room:start")).toEqual({ ok: true });
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
    const { core, host } = hosted();
    const { client: guest } = join(core);
    host.call("room:addBot");
    const errors = [autoplay(host), autoplay(guest)];
    const finished = host.next("room:state", (s) => s.status === "finished", 30_000);
    expect(host.call("room:start")).toEqual({ ok: true });
    await finished.catch((e) => {
      throw new Error(`${e}; input errors: ${errors.flat().join(", ")}`);
    });
    expect(core.status).toBe("finished");
  }, 40_000);

  it("ignores the seat a client claims and checks inputs with the engine", async () => {
    const { core, host } = hosted();
    const { client: guest, seatId: guestId } = join(core);
    const sync = host.next("game:sync");
    host.call("room:start");
    const { view } = await sync;
    const actor = view.turn.actorId;
    const notActing = actor === guestId ? host : guest;
    // Pretending to be the acting seat does not work: the input counts as the sender's own.
    expect(
      notActing.call("game:input", {
        input: { type: "DECLARE", playerId: actor, action: "income" },
      }),
    ).toEqual({ ok: false, error: "NOT_YOUR_TURN" });
    expect(guest.call("game:input", { input: { type: "TIMEOUT" } })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
  });

  it("lets a player reconnect mid-game with their token and catch up", async () => {
    const { core, host } = hosted();
    const { client: guest, seatId, sessionToken } = join(core);
    const started = guest.next("game:sync");
    host.call("room:start");
    await started;
    const dropped = host.next("room:state", (s) => s.seats[1]?.connected === false);
    guest.drop();
    await dropped;

    const again = new Client(core);
    const caughtUp = again.next("game:sync");
    const back = again.call("room:join", {
      protocolVersion: v,
      code: CODE,
      name: "ignored",
      sessionToken,
    });
    expect(back).toMatchObject({ ok: true, seatId, sessionToken });
    const sync = await caughtUp;
    expect(sync.view.viewerId).toBe(seatId);
    expect(sync.log[0]?.type).toBe("GAME_STARTED");
    const sticker = host.next("chat:sticker");
    expect(again.call("chat:sticker", { sticker: "duke" })).toEqual({ ok: true });
    expect(await sticker).toEqual({ seatId, sticker: "duke" });
  });

  it("lets a bot play for someone who dropped out, and hands the seat back (docs §5.3)", async () => {
    const { core, host } = hosted({ standInMs: 100 });
    const { client: guest, seatId, sessionToken } = join(core);
    // Only the host plays; the guest's turns wait for the stand-in.
    autoplay(host);
    const started = guest.next("game:sync");
    host.call("room:start");
    await started;

    const replaced = host.next("room:state", (s) => s.seats[1]?.standIn === true, 2_000);
    guest.drop();
    expect((await replaced).seats[1]).toMatchObject({ id: seatId, connected: false });

    // The stand-in plays the dropped seat's turns: the game moves on with only the host acting.
    await host.next("game:update", (u) => u.view.turnNumber >= 3, 10_000);

    const returned = host.next("room:state", (s) => s.seats[1]?.standIn === false);
    join(core, "ignored", sessionToken);
    expect((await returned).seats[1]).toMatchObject({ connected: true, standIn: false });
  });

  it("hands a seat to a bot at once when its person leaves mid-game", async () => {
    const { core, host } = hosted();
    const { client: guest } = join(core);
    const started = guest.next("game:sync");
    host.call("room:start");
    await started;
    const replaced = host.next("room:state", (s) => s.seats[1]?.standIn === true, 1_000);
    expect(guest.call("room:leave")).toEqual({ ok: true });
    await replaced;
  });

  it("closes a game nobody is connected to any more", async () => {
    const { core, host } = hosted({ idleRoomMs: 100 });
    const { client: guest } = join(core);
    host.call("room:start");
    host.drop();
    guest.drop();
    await new Promise((r) => setTimeout(r, 200));
    expect(core.isOpen).toBe(false);
  });
});

describe("surviving a restart (docs/architecture.md §5.5)", () => {
  /** Hooks that keep the last saved snapshot as the Durable Object's storage would (JSON). */
  function storage() {
    const store: { saved: RoomSnapshot | null; saves: number; alarm: number | null } = {
      saved: null,
      saves: 0,
      alarm: null,
    };
    const hooks: RoomHooks = {
      save: (snapshot) => {
        store.saves++;
        store.saved = snapshot ? JSON.parse(JSON.stringify(snapshot)) : null;
      },
      setIdleAlarm: (at) => {
        store.alarm = at;
      },
    };
    return { store, hooks };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("saves once per burst of changes and forgets the room when it closes", async () => {
    const { store, hooks } = storage();
    const { core, host } = hosted({}, hooks);
    await tick();
    expect(store.saved?.room.code).toBe(CODE);
    const before = store.saves;
    host.call("room:addBot");
    host.call("room:settings", { settings: { pace: "fast" } });
    await tick();
    expect(store.saves).toBe(before + 1);
    expect(store.saved?.room.seats).toHaveLength(2);
    host.call("room:leave");
    await tick();
    expect(core.isOpen).toBe(false);
    expect(store.saved).toBeNull();
  });

  it("picks a game up after a restart: players reconnect and play it to the end", async () => {
    const { store, hooks } = storage();
    const { core, host } = hosted({}, hooks);
    const { sessionToken: guestToken } = join(core);
    host.call("room:addBot");
    const started = host.next("game:sync");
    host.call("room:start");
    const { view } = await started;
    await tick();
    const saved = store.saved as RoomSnapshot;
    const hostToken = (saved.room.seats[0] as { token: string }).token;
    core.dispose(); // the object goes away mid-game

    const revived = new RoomCore({ speed: 0.02 }, hooks);
    cores.push(revived);
    revived.restore(saved);
    expect(revived.status).toBe("playing");
    expect(store.alarm).not.toBeNull(); // nobody connected yet: cleanup is scheduled

    const host2 = new Client(revived);
    const guest2 = new Client(revived);
    const errors = [autoplay(host2), autoplay(guest2)];
    const synced = host2.next("game:sync");
    host2.call("room:join", { protocolVersion: v, code: CODE, name: "x", sessionToken: hostToken });
    guest2.call("room:join", {
      protocolVersion: v,
      code: CODE,
      name: "x",
      sessionToken: guestToken,
    });
    expect((await synced).view.turnNumber).toBeGreaterThanOrEqual(view.turnNumber);
    expect(store.alarm).toBeNull(); // someone is back

    const finished = host2.next("room:state", (s) => s.status === "finished", 30_000);
    await finished.catch((e) => {
      throw new Error(`${e}; input errors: ${errors.flat().join(", ")}`);
    });
  }, 40_000);

  it("lets bots stand in for people who never come back after a restart", async () => {
    const { store, hooks } = storage();
    const { core, host } = hosted({}, hooks);
    join(core);
    const started = host.next("game:sync");
    host.call("room:start");
    await started;
    await tick();
    const saved = store.saved as RoomSnapshot;
    core.dispose();

    const revived = new RoomCore({ speed: 0.02, standInMs: 50 }, hooks);
    cores.push(revived);
    revived.restore(saved);
    await new Promise((r) => setTimeout(r, 150));
    await tick();
    expect(store.saved?.room.seats.every((s) => s.kind === "human" && s.standIn)).toBe(true);
  });

  it("closes when the idle alarm finds nobody", async () => {
    const { store, hooks } = storage();
    const { core, host } = hosted({}, hooks);
    host.drop();
    expect(store.alarm).not.toBeNull();
    core.expireIfIdle();
    await tick();
    expect(core.isOpen).toBe(false);
    expect(store.saved).toBeNull();
  });
});
