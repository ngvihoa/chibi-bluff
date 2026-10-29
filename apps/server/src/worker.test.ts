// The real Worker and Durable Object, run locally by wrangler (Miniflare): HTTP routes, origin
// checks, and a room over a real WebSocket.

import { PROTOCOL_VERSION, type ServerFrame } from "@chibi-bluff/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unstable_startWorker } from "wrangler";

let worker: Awaited<ReturnType<typeof unstable_startWorker>>;
let base: string;

beforeAll(async () => {
  worker = await unstable_startWorker({
    config: new URL("../wrangler.jsonc", import.meta.url).pathname,
    bindings: { GAME_SPEED: { type: "plain_text", value: "0.02" } },
    dev: { server: { hostname: "127.0.0.1", port: 0 }, inspector: false },
  });
  base = (await worker.url).origin;
}, 60_000);

afterAll(async () => {
  await worker?.dispose();
});

const create = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

/** A WebSocket client that answers `call` with the matching reply frame. */
async function open(code: string) {
  const socket = new WebSocket(`${base.replace("http", "ws")}/rooms/${code}/ws`);
  const frames: ServerFrame[] = [];
  const waiters = new Set<() => void>();
  socket.addEventListener("message", (event) => {
    frames.push(JSON.parse(String(event.data)) as ServerFrame);
    for (const wake of [...waiters]) wake();
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  /** Waits for the first frame (seen or future) that matches. */
  const waitFor = (match: (f: ServerFrame) => boolean, timeoutMs = 5_000) =>
    new Promise<ServerFrame>((resolve, reject) => {
      const check = () => {
        const found = frames.find(match);
        if (!found) return;
        waiters.delete(check);
        clearTimeout(timer);
        resolve(found);
      };
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error("timed out waiting for a frame"));
      }, timeoutMs);
      waiters.add(check);
      check();
    });
  let nextId = 1;
  const call = async (type: string, payload: unknown = {}) => {
    const id = nextId++;
    socket.send(JSON.stringify({ id, type, payload }));
    const frame = await waitFor((f) => "re" in f && f.re === id);
    return (frame as { reply: { ok: boolean } & Record<string, unknown> }).reply;
  };
  return { socket, call, waitFor };
}

describe("worker routes", () => {
  it("answers the health check", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("only lets the web app's origins in", async () => {
    expect(
      (await fetch(`${base}/healthz`, { headers: { Origin: "https://evil.example" } })).status,
    ).toBe(403);
    const local = await fetch(`${base}/healthz`, { headers: { Origin: "http://localhost:3000" } });
    expect(local.status).toBe(200);
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });

  it("answers the CORS preflight for creating rooms", async () => {
    const res = await fetch(`${base}/rooms`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toBe("POST");
  });

  it("validates room creation and room codes", async () => {
    const old = await create({ protocolVersion: 1, name: "A" });
    expect(old.status).toBe(400);
    expect(await old.json()).toEqual({ ok: false, error: "VERSION_MISMATCH" });
    expect((await create({ protocolVersion: PROTOCOL_VERSION })).status).toBe(400);
    expect((await fetch(`${base}/rooms/not-a-code/ws`)).status).toBe(400);
    expect((await fetch(`${base}/rooms/ABCDE/ws`)).status).toBe(426); // not a WebSocket
    expect((await fetch(`${base}/nowhere`)).status).toBe(404);
  });
});

describe("a room over WebSocket", () => {
  it("creates a room, seats the host and a guest, and deals each only their own cards", async () => {
    const res = await create(
      { protocolVersion: PROTOCOL_VERSION, name: "Chủ", locale: "vi" },
      { Origin: "http://localhost:3000" },
    );
    expect(res.status).toBe(200);
    const room = (await res.json()) as { code: string; seatId: string; sessionToken: string };
    expect(room.code).toMatch(/^[A-Z2-9]{5}$/);

    const host = await open(room.code);
    expect(
      await host.call("room:join", {
        protocolVersion: PROTOCOL_VERSION,
        code: room.code,
        name: "Chủ",
        sessionToken: room.sessionToken,
      }),
    ).toMatchObject({ ok: true, seatId: room.seatId });

    const guest = await open(room.code);
    const joined = await guest.call("room:join", {
      protocolVersion: PROTOCOL_VERSION,
      code: room.code,
      name: "Khách",
    });
    expect(joined).toMatchObject({ ok: true });
    await host.waitFor(
      (f) => "type" in f && f.type === "room:state" && f.payload.seats.length === 2,
    );

    expect(await host.call("room:addBot")).toEqual({ ok: true });
    expect(await host.call("room:start")).toEqual({ ok: true });
    const sync = await guest.waitFor((f) => "type" in f && f.type === "game:sync");
    if (!("type" in sync) || sync.type !== "game:sync") throw new Error("not a sync");
    expect(sync.payload.view.viewerId).toBe(joined.seatId);
    for (const p of sync.payload.view.players) {
      for (const card of p.cards) {
        if (p.id === joined.seatId) expect(card.role).not.toBeNull();
        else expect(card.role).toBeNull();
      }
    }

    // Pings keep the connection alive without a reply id.
    guest.socket.send(JSON.stringify({ type: "ping" }));
    await guest.waitFor((f) => "type" in f && f.type === "pong");
    host.socket.close();
    guest.socket.close();
  });

  it("says when a room does not exist", async () => {
    const client = await open("ZZZZZ");
    expect(
      await client.call("room:join", {
        protocolVersion: PROTOCOL_VERSION,
        code: "ZZZZZ",
        name: "A",
      }),
    ).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    client.socket.close();
  });
});
