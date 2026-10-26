"use client";

// The browser side of one online room: joining (or taking a remembered seat back), the lobby
// as the server describes it, and the game through a SocketHost (docs/architecture.md §5).

import type { EngineError } from "@chibi-bluff/engine";
import {
  type AckFor,
  type ClientMessageName,
  type GameSync,
  type GameUpdate,
  PROTOCOL_VERSION,
  type ProtocolErrorCode,
  type RoomSettings,
  type RoomView,
} from "@chibi-bluff/protocol";
import type { SeatInfo } from "@/game/host";
import { SocketHost } from "@/game/socket-host";
import {
  acquireSocket,
  type GameSocket,
  releaseSocket,
  request,
  savedName,
  savedSeat,
  saveName,
  saveSeat,
} from "./connection";

export type RoomStage = "connecting" | "needName" | "joining" | "inRoom" | "failed" | "kicked";
export type RoomError = ProtocolErrorCode | EngineError;

export interface RoomState {
  stage: RoomStage;
  code: string;
  room: RoomView | null;
  /** Why joining failed (stage "failed"). */
  error: RoomError | null;
  /** The socket is connected right now. */
  online: boolean;
  /** The server announced a restart. */
  closing: boolean;
  /** Present once a game has started in this room. */
  game: SocketHost | null;
}

const AUTO_JOIN_KEY = "chibi-bluff:auto-join";

/** The join screen already asked for a name: the room page joins without asking again. */
export function markAutoJoin(code: string) {
  try {
    sessionStorage.setItem(AUTO_JOIN_KEY, code);
  } catch {
    // Without storage the room page simply asks for the name.
  }
}
function autoJoinMarked(code: string): boolean {
  try {
    return sessionStorage.getItem(AUTO_JOIN_KEY) === code;
  } catch {
    return false;
  }
}
function clearAutoJoin() {
  try {
    sessionStorage.removeItem(AUTO_JOIN_KEY);
  } catch {
    // Nothing was stored.
  }
}

const seatsOf = (room: RoomView | null): SeatInfo[] =>
  (room?.seats ?? []).map(({ id, name, kind, avatar }) => ({ id, name, kind, avatar }));

export class RoomClient {
  private state: RoomState;
  private readonly socket: GameSocket;
  private readonly listeners = new Set<() => void>();
  private readonly detach: (() => void)[] = [];

  constructor(code: string) {
    this.socket = acquireSocket();
    this.state = {
      stage: "connecting",
      code,
      room: null,
      error: null,
      online: this.socket.connected,
      closing: false,
      game: null,
    };
    const on = <A extends unknown[]>(event: string, handler: (...args: A) => void) => {
      const target = this.socket as unknown as {
        on(e: string, h: (...args: A) => void): void;
        off(e: string, h: (...args: A) => void): void;
      };
      target.on(event, handler);
      this.detach.push(() => target.off(event, handler));
    };
    on("connect", () => {
      this.set({ online: true });
      // Back after a network drop: take the seat again.
      if (this.state.stage === "inRoom") void this.join(savedName());
    });
    on("disconnect", () => this.set({ online: false }));
    on("room:state", (room: RoomView) => {
      this.state.game?.setSeats(seatsOf(room));
      this.set({ room });
    });
    on("game:sync", (sync: GameSync) => {
      const { game } = this.state;
      if (game) game.sync(sync);
      else this.set({ game: new SocketHost(seatsOf(this.state.room), sync, (i) => this.input(i)) });
    });
    on("game:update", (update: GameUpdate) => this.state.game?.update(update));
    on("room:kicked", () => {
      saveSeat(code, null);
      this.set({ stage: "kicked" });
    });
    on("server:closing", () => this.set({ closing: true }));
  }

  getSnapshot = (): RoomState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Takes a remembered seat back, or asks for a name first. */
  start(): void {
    const { code } = this.state;
    if (savedSeat(code) || (autoJoinMarked(code) && savedName())) void this.join(savedName());
    else this.set({ stage: "needName" });
  }

  async join(name: string): Promise<void> {
    const { code } = this.state;
    const seat = savedSeat(code);
    if (this.state.stage !== "inRoom") this.set({ stage: "joining", error: null });
    const ack = await request(this.socket, "room:join", {
      protocolVersion: PROTOCOL_VERSION,
      code,
      name: name || "?",
      sessionToken: seat?.sessionToken,
    });
    clearAutoJoin();
    if (ack.ok) {
      saveSeat(code, { seatId: ack.seatId, sessionToken: ack.sessionToken });
      if (name) saveName(name);
      this.set({ stage: "inRoom" });
      return;
    }
    // A remembered seat in a room that is gone: forget it.
    if (ack.error === "ROOM_NOT_FOUND") saveSeat(code, null);
    this.set({ stage: "failed", error: ack.error });
  }

  updateSettings = (settings: Partial<RoomSettings>) => this.call("room:settings", { settings });
  addBot = () => this.call("room:addBot");
  removeBot = (seatId: string) => this.call("room:removeBot", { seatId });
  kick = (seatId: string) => this.call("room:kick", { seatId });
  startGame = () => this.call("room:start");

  /** Gives the seat up for good. */
  async leave(): Promise<void> {
    await this.call("room:leave");
    saveSeat(this.state.code, null);
  }

  dispose(): void {
    for (const off of this.detach) off();
    this.state.game?.dispose();
    this.listeners.clear();
    releaseSocket();
  }

  private input(input: Parameters<SocketHost["submit"]>[0]) {
    void request(this.socket, "game:input", { input });
  }

  /** Sends a lobby message; resolves with the error, if any. */
  private async call<N extends ClientMessageName>(name: N, payload?: unknown) {
    const ack: AckFor<N> = await request(this.socket, name, payload);
    return ack.ok ? null : ack.error;
  }

  private set(patch: Partial<RoomState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
