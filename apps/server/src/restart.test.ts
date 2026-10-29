// A room survives its Durable Object restarting: run the real Worker, start a game, stop the
// runtime, start it again on the same storage, and take the seat back.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROTOCOL_VERSION, type ServerFrame } from "@chibi-bluff/protocol";
import { afterAll, describe, expect, it } from "vitest";
import { unstable_startWorker } from "wrangler";

const persist = mkdtempSync(join(tmpdir(), "chibi-bluff-do-"));
afterAll(() => rmSync(persist, { recursive: true, force: true }));

const start = () =>
  unstable_startWorker({
    config: new URL("../wrangler.jsonc", import.meta.url).pathname,
    bindings: { GAME_SPEED: { type: "plain_text", value: "0.05" } },
    dev: { server: { hostname: "127.0.0.1", port: 0 }, inspector: false, persist },
  });

async function open(base: string, code: string) {
  const socket = new WebSocket(`${base.replace("http", "ws")}/rooms/${code}/ws`);
  const frames: ServerFrame[] = [];
  socket.addEventListener("message", (e) => frames.push(JSON.parse(String(e.data))));
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const waitFor = async (match: (f: ServerFrame) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const found = frames.find(match);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("timed out waiting for a frame");
  };
  let id = 1;
  const call = async (type: string, payload: unknown = {}) => {
    const mine = id++;
    socket.send(JSON.stringify({ id: mine, type, payload }));
    const frame = await waitFor((f) => "re" in f && f.re === mine);
    return (frame as { reply: { ok: boolean } & Record<string, unknown> }).reply;
  };
  return { socket, call, waitFor };
}

describe("a room across a restart", () => {
  it("keeps the game: the player reconnects with their token and catches up", async () => {
    let worker = await start();
    let base = (await worker.url).origin;
    const created = (await (
      await fetch(`${base}/rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolVersion: PROTOCOL_VERSION, name: "Chủ" }),
      })
    ).json()) as { code: string; seatId: string; sessionToken: string };
    const join = { protocolVersion: PROTOCOL_VERSION, code: created.code, name: "Chủ" };

    const host = await open(base, created.code);
    expect(
      await host.call("room:join", { ...join, sessionToken: created.sessionToken }),
    ).toMatchObject({ ok: true });
    expect(await host.call("room:addBot")).toEqual({ ok: true });
    expect(await host.call("room:start")).toEqual({ ok: true });
    await host.waitFor((f) => "type" in f && f.type === "game:sync");
    host.socket.close();
    await worker.dispose(); // the runtime (and the object) goes away mid-game

    worker = await start();
    base = (await worker.url).origin;
    const back = await open(base, created.code);
    const reply = await back.call("room:join", { ...join, sessionToken: created.sessionToken });
    expect(reply).toMatchObject({ ok: true, seatId: created.seatId });
    const sync = await back.waitFor((f) => "type" in f && f.type === "game:sync");
    if (!("type" in sync) || sync.type !== "game:sync") throw new Error("not a sync");
    expect(sync.payload.view.viewerId).toBe(created.seatId);
    expect(sync.payload.log[0]?.type).toBe("GAME_STARTED");
    back.socket.close();
    await worker.dispose();
  }, 60_000);
});
