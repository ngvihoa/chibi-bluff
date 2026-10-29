"use client";

// The browser side of one online room: joining (or taking a remembered seat back), the lobby
// as the server describes it, and the game through a SocketHost (docs/architecture.md §5).

import type { EngineError, Role } from "@chibi-bluff/engine";
import {
  type AckFor,
  PROTOCOL_VERSION,
  type ProtocolErrorCode,
  type RoomSettings,
  type RoomView,
  type ServerMessageName,
  type ServerMessages,
  type SocketMessageName,
} from "@chibi-bluff/protocol";
import type { SeatInfo } from "@/game/host";
import { SocketHost } from "@/game/socket-host";
import { RoomSocket, SEAT_TAKEN, savedName, savedSeat, saveName, saveSeat } from "./connection";

export type RoomStage =
  | "connecting"
  | "needName"
  | "joining"
  | "inRoom"
  | "failed"
  | "kicked"
  /** The same seat was opened in another tab, which now has it. */
  | "replaced";
export type RoomError = ProtocolErrorCode | EngineError;

export interface RoomState {
  stage: RoomStage;
  code: string;
  room: RoomView | null;
  /** Why joining failed (stage "failed"). */
  error: RoomError | null;
  /** The socket is connected right now. */
  online: boolean;
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

/** What the table shows for each seat: bots named in the viewer's language, people's status. */
export function seatsOf(room: RoomView | null, botName: (avatar: Role) => string): SeatInfo[] {
  return (room?.seats ?? []).map(({ id, name, kind, avatar, connected, standIn }) => ({
    id,
    name: kind === "bot" ? botName(avatar) : name,
    kind,
    avatar,
    ...(standIn ? { status: "standIn" as const } : connected ? {} : { status: "offline" as const }),
  }));
}

export class RoomClient {
  private state: RoomState;
  private readonly socket: RoomSocket;
  private readonly listeners = new Set<() => void>();

  /** `botName` names bots in this viewer's language (the server only knows the creator's). */
  constructor(
    code: string,
    private readonly botName: (avatar: Role) => string,
  ) {
    this.state = { stage: "connecting", code, room: null, error: null, online: false, game: null };
    this.socket = RoomSocket.forRoom(code, {
      onOpen: () => {
        this.set({ online: true });
        // Back after a network drop: take the seat again.
        if (this.state.stage === "inRoom") void this.join(savedName());
      },
      onClose: (closeCode) => {
        this.set({ online: false, ...(closeCode === SEAT_TAKEN ? { stage: "replaced" } : {}) });
      },
      onMessage: (type, payload) => this.receive(type, payload),
    });
  }

  private receive<N extends ServerMessageName>(type: N, payload: ServerMessages[N]) {
    const message = { type, payload } as {
      [K in ServerMessageName]: { type: K; payload: ServerMessages[K] };
    }[ServerMessageName];
    switch (message.type) {
      case "room:state":
        this.state.game?.setSeats(seatsOf(message.payload, this.botName));
        this.set({ room: message.payload });
        break;
      case "game:sync": {
        const { game } = this.state;
        if (game) {
          game.sync(message.payload);
          break;
        }
        const host = new SocketHost(
          seatsOf(this.state.room, this.botName),
          message.payload,
          (input) => void this.socket.request("game:input", { input }),
          (sticker) => void this.call("chat:sticker", { sticker }),
        );
        this.set({ game: host });
        break;
      }
      case "game:update":
        this.state.game?.update(message.payload);
        break;
      case "chat:sticker":
        this.state.game?.stickers.show(message.payload.seatId, message.payload.sticker);
        break;
      case "room:kicked":
        saveSeat(this.state.code, null);
        this.set({ stage: "kicked" });
        break;
      case "pong":
        break;
    }
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
    const ack = await this.socket.request("room:join", {
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
    this.socket.close();
    this.state.game?.dispose();
    this.listeners.clear();
  }

  /** Sends a lobby message; resolves with the error, if any. */
  private async call<N extends Exclude<SocketMessageName, "ping">>(name: N, payload?: unknown) {
    const ack: AckFor<N> = await this.socket.request(name, payload);
    return ack.ok ? null : ack.error;
  }

  private set(patch: Partial<RoomState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
