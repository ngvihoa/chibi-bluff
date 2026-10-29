"use client";

// Talking to the game server (docs/architecture.md §5.5): `POST /rooms` to create a room, and one
// WebSocket per room page (`/rooms/<code>/ws`) that reconnects on its own, matches replies to
// requests, and pings to notice a dead connection. Seats are remembered per room code in
// localStorage, so a reload or a killed mobile tab can take the seat back.

import type {
  AckFor,
  ClientMessage,
  ServerFrame,
  ServerMessageName,
  ServerMessages,
  SocketMessageName,
} from "@chibi-bluff/protocol";

/** Where the game server lives (docs/deployment.md). */
export const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:8080";

const REQUEST_TIMEOUT_MS = 8_000;
const PING_EVERY_MS = 25_000;
/** No pong this long after a ping: the connection is dead even if the browser has not noticed. */
const PONG_WITHIN_MS = 10_000;
const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 5_000;
/** Close code the server uses when the same seat was opened in another tab. */
export const SEAT_TAKEN = 4000;

/** Creates a room; the reply carries the host's seat and token. */
export async function createRoom(
  body: ClientMessage<"room:create">,
): Promise<AckFor<"room:create">> {
  try {
    const res = await fetch(`${SERVER_URL}/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return (await res.json()) as AckFor<"room:create">;
  } catch {
    return { ok: false, error: "SERVER_UNREACHABLE" };
  }
}

/** The bit of WebSocket the room socket needs (tests pass a fake). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface RoomSocketHandlers {
  onOpen(): void;
  /** `code` is the WebSocket close code; `retrying` is false when the socket gave up for good. */
  onClose(code: number, retrying: boolean): void;
  onMessage<N extends ServerMessageName>(type: N, payload: ServerMessages[N]): void;
}

const OPEN = 1;

interface Pending {
  resolve(reply: unknown): void;
  timer: ReturnType<typeof setTimeout>;
}

/** One room's WebSocket, kept open until `close()`. */
export class RoomSocket {
  private socket: SocketLike | null = null;
  private readonly pending = new Map<number, Pending>();
  /** Frames waiting for the socket to open. */
  private readonly outbox: string[] = [];
  private nextId = 1;
  private retryMs = RETRY_MIN_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly handlers: RoomSocketHandlers,
    private readonly open: (url: string) => SocketLike = (u) => new WebSocket(u) as SocketLike,
  ) {
    this.connect();
  }

  static forRoom(code: string, handlers: RoomSocketHandlers) {
    const url = `${SERVER_URL.replace(/^http/, "ws")}/rooms/${encodeURIComponent(code)}/ws`;
    return new RoomSocket(url, handlers);
  }

  get isOpen(): boolean {
    return this.socket?.readyState === OPEN;
  }

  /** Sends a message and waits for its reply. Gives up with SERVER_UNREACHABLE after 8 s. */
  request<N extends Exclude<SocketMessageName, "ping">>(
    type: N,
    payload: unknown = {},
  ): Promise<AckFor<N>> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: "SERVER_UNREACHABLE" });
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve as (reply: unknown) => void, timer });
      this.send(JSON.stringify({ id, type, payload }));
    });
  }

  /** Stops for good: no more reconnecting. */
  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.stopPinging();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close(1000, "left the room");
    }
    this.failPending();
  }

  // ---------- Internals ----------

  private connect() {
    if (this.closed) return;
    const socket = this.open(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.retryMs = RETRY_MIN_MS;
      for (const frame of this.outbox.splice(0)) socket.send(frame);
      this.startPinging();
      this.handlers.onOpen();
    };
    socket.onmessage = (event) => this.receive(event.data);
    socket.onerror = () => {
      // A close event follows; reconnecting happens there.
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.stopPinging();
      this.failPending();
      // Another tab took the seat: coming back would just steal it back.
      const retrying = !this.closed && event.code !== SEAT_TAKEN;
      this.handlers.onClose(event.code, retrying);
      if (retrying) this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    const wait = this.retryMs;
    this.retryMs = Math.min(RETRY_MAX_MS, this.retryMs * 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, wait);
  }

  private send(frame: string) {
    if (this.socket?.readyState === OPEN) this.socket.send(frame);
    else this.outbox.push(frame);
  }

  private receive(data: unknown) {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(String(data)) as ServerFrame;
    } catch {
      return;
    }
    if ("re" in frame) {
      const waiting = this.pending.get(frame.re);
      if (!waiting) return;
      clearTimeout(waiting.timer);
      this.pending.delete(frame.re);
      waiting.resolve(frame.reply);
      return;
    }
    if (frame.type === "pong") {
      if (this.pongTimer) clearTimeout(this.pongTimer);
      this.pongTimer = null;
      return;
    }
    this.handlers.onMessage(frame.type, frame.payload as never);
  }

  private startPinging() {
    this.stopPinging();
    this.pingTimer = setInterval(() => {
      const socket = this.socket;
      if (socket?.readyState !== OPEN) return;
      socket.send(JSON.stringify({ type: "ping" }));
      if (this.pongTimer) return;
      // No answer: drop the connection so the retry loop takes over.
      this.pongTimer = setTimeout(() => socket.close(4001, "no pong"), PONG_WITHIN_MS);
    }, PING_EVERY_MS);
  }

  private stopPinging() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pingTimer = null;
    this.pongTimer = null;
  }

  /** Requests in flight on a lost connection will never get their reply. */
  private failPending() {
    for (const [id, waiting] of this.pending) {
      clearTimeout(waiting.timer);
      waiting.resolve({ ok: false, error: "SERVER_UNREACHABLE" });
      this.pending.delete(id);
    }
  }
}

// ---------- Remembered seats ----------

export interface SavedSeat {
  seatId: string;
  sessionToken: string;
}

const seatKey = (code: string) => `chibi-bluff:room:${code}`;
const NAME_KEY = "chibi-bluff:name";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the seat just is not remembered.
  }
}

export function savedSeat(code: string): SavedSeat | null {
  try {
    const value = JSON.parse(read(seatKey(code)) ?? "null") as SavedSeat | null;
    return value && typeof value.sessionToken === "string" ? value : null;
  } catch {
    return null;
  }
}
export function saveSeat(code: string, seat: SavedSeat | null) {
  write(seatKey(code), seat ? JSON.stringify(seat) : null);
}
export const savedName = () => read(NAME_KEY) ?? "";
export const saveName = (name: string) => write(NAME_KEY, name);
