"use client";

// One Socket.IO connection to the game server, shared by the create/join screen and the room
// page so moving between them never drops the seat. Seats are remembered per room code in
// localStorage, so a reload or a killed mobile tab can take the seat back (docs §5.1).

import type {
  AckFor,
  ClientMessageName,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@chibi-bluff/protocol";
import { io, type Socket } from "socket.io-client";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Where the game server lives (docs/deployment.md). */
export const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:8080";

let socket: GameSocket | null = null;
let users = 0;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

/** Takes a reference on the shared socket (connecting it if needed). Call `release` when done. */
export function acquireSocket(): GameSocket {
  users += 1;
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
  socket ??= io(SERVER_URL, { transports: ["websocket"], autoConnect: true });
  if (socket.disconnected) socket.connect();
  return socket;
}

/** Drops a reference. The socket closes shortly after the last one, unless a page takes it
 * again first (navigation between pages, React remounts). */
export function releaseSocket(): void {
  users = Math.max(0, users - 1);
  if (users > 0 || closeTimer) return;
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (users === 0) socket?.disconnect();
  }, 1_000);
}

const ACK_TIMEOUT_MS = 8_000;

/** Sends a message and waits for the server's answer (a timeout counts as a failure). */
export function request<N extends ClientMessageName>(
  target: GameSocket,
  name: N,
  payload: unknown = {},
): Promise<AckFor<N>> {
  // The mapped event types do not survive `timeout()`, which changes the ack's arguments.
  const timed = target.timeout(ACK_TIMEOUT_MS) as unknown as {
    emit(event: N, payload: unknown, ack: (error: Error | null, reply: AckFor<N>) => void): void;
  };
  return new Promise((resolve) => {
    timed.emit(name, payload, (error, reply) => {
      resolve(error ? { ok: false, error: "SERVER_UNREACHABLE" } : reply);
    });
  });
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
