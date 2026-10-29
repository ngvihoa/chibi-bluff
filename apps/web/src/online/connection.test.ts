import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomSocket, type RoomSocketHandlers, SEAT_TAKEN, type SocketLike } from "./connection";

/** A WebSocket the test drives by hand. */
class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  closedWith: number | null = null;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code = 1000) {
    this.closedWith = code;
    this.readyState = 3;
  }
  // Test controls:
  opens() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receives(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  drops(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

let sockets: FakeSocket[];
let handlers: {
  onOpen: ReturnType<typeof vi.fn<RoomSocketHandlers["onOpen"]>>;
  onClose: ReturnType<typeof vi.fn<RoomSocketHandlers["onClose"]>>;
  onMessage: ReturnType<typeof vi.fn<(type: string, payload: unknown) => void>>;
};
const make = () =>
  new RoomSocket("ws://test/rooms/ABCDE/ws", handlers as unknown as RoomSocketHandlers, () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });
const last = () => sockets.at(-1) as FakeSocket;

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  handlers = {
    onOpen: vi.fn<RoomSocketHandlers["onOpen"]>(),
    onClose: vi.fn<RoomSocketHandlers["onClose"]>(),
    onMessage: vi.fn<(type: string, payload: unknown) => void>(),
  };
});
afterEach(() => {
  vi.useRealTimers();
});

describe("RoomSocket", () => {
  it("holds requests until the socket opens and matches replies by id", async () => {
    const room = make();
    const join = room.request("room:join", { code: "ABCDE" });
    const start = room.request("room:start");
    expect(last().sent).toEqual([]);
    last().opens();
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
    expect(last().sent.map((f) => f.type)).toEqual(["room:join", "room:start"]);
    const [joinId, startId] = last().sent.map((f) => f.id);
    last().receives({ re: startId, reply: { ok: false, error: "NOT_HOST" } });
    last().receives({ re: joinId, reply: { ok: true, seatId: "p-1" } });
    expect(await join).toEqual({ ok: true, seatId: "p-1" });
    expect(await start).toEqual({ ok: false, error: "NOT_HOST" });
  });

  it("passes server messages on, and swallows pongs", () => {
    make();
    last().opens();
    last().receives({ type: "room:kicked", payload: {} });
    last().receives({ type: "pong", payload: {} });
    expect(handlers.onMessage).toHaveBeenCalledTimes(1);
    expect(handlers.onMessage).toHaveBeenCalledWith("room:kicked", {});
  });

  it("gives up on a request after 8 seconds", async () => {
    const room = make();
    last().opens();
    const reply = room.request("room:addBot");
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await reply).toEqual({ ok: false, error: "SERVER_UNREACHABLE" });
  });

  it("fails requests in flight when the connection drops, then reconnects with backoff", async () => {
    const room = make();
    last().opens();
    const reply = room.request("room:addBot");
    last().drops();
    expect(await reply).toEqual({ ok: false, error: "SERVER_UNREACHABLE" });
    expect(handlers.onClose).toHaveBeenCalledWith(1006, true);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(sockets).toHaveLength(2);
    last().drops();
    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(2); // waits longer each time
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(3);
    last().opens();
    expect(handlers.onOpen).toHaveBeenCalledTimes(2);
  });

  it("does not fight another tab for the seat", async () => {
    make();
    last().opens();
    last().drops(SEAT_TAKEN);
    expect(handlers.onClose).toHaveBeenCalledWith(SEAT_TAKEN, false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sockets).toHaveLength(1);
  });

  it("pings, and drops a connection that stops answering", async () => {
    make();
    last().opens();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(last().sent).toEqual([{ type: "ping" }]);
    last().receives({ type: "pong", payload: {} });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(last().sent).toHaveLength(2);
    // No pong this time: after 10 s the socket is closed so the retry loop takes over.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(last().closedWith).toBe(4001);
  });

  it("stops for good when closed", async () => {
    const room = make();
    last().opens();
    room.close();
    expect(last().closedWith).toBe(1000);
    expect(handlers.onClose).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sockets).toHaveLength(1);
  });
});
