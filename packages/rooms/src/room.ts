// A room for online play (docs/architecture.md §5.1), as plain data with pure updates. The server
// owns sockets, timers, ids and randomness; it feeds them in as actions, so every rule about
// who may sit, start, kick or change settings lives here and is tested without a network.

import { type PlayerId, ROLES, type Role } from "@chibi-bluff/engine";
import { botFor, type MatchOptions, PACES } from "@chibi-bluff/match";
import {
  DEFAULT_ROOM_SETTINGS,
  MAX_SEATS,
  MIN_SEATS_TO_START,
  type ProtocolErrorCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RoomSettings,
  type RoomStatus,
  type RoomView,
} from "@chibi-bluff/protocol";

export type RoomSeat =
  | {
      kind: "human";
      id: PlayerId;
      name: string;
      avatar: Role;
      /** Secret that lets this seat's browser reclaim it. Never sent to other seats. */
      token: string;
      connected: boolean;
    }
  | { kind: "bot"; id: PlayerId; name: string; avatar: Role };

export interface Room {
  code: string;
  status: RoomStatus;
  hostId: PlayerId;
  settings: RoomSettings;
  /** Seat order is play order. */
  seats: RoomSeat[];
}

/** A person arriving: the server makes up the id and token. */
export interface Arrival {
  seatId: PlayerId;
  token: string;
  name: string;
}

export type RoomAction =
  | ({ type: "join" } & Arrival)
  /** Leaving for good (a closed tab is a `connection` change instead). */
  | { type: "leave"; seatId: PlayerId }
  | { type: "connection"; seatId: PlayerId; connected: boolean }
  /** The server picks the bot's look with `nextAvatar` and its name from the theme. */
  | { type: "addBot"; by: PlayerId; seatId: PlayerId; name: string; avatar: Role }
  | { type: "removeBot"; by: PlayerId; seatId: PlayerId }
  | { type: "kick"; by: PlayerId; seatId: PlayerId }
  | { type: "settings"; by: PlayerId; settings: Partial<RoomSettings> }
  | { type: "start"; by: PlayerId }
  | { type: "finish" };

export type RoomResult = { ok: true; room: Room } | { ok: false; error: ProtocolErrorCode };

/** Room code from a source of random numbers in [0, 1). */
export function roomCode(random: () => number): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function createRoom(
  code: string,
  host: Arrival,
  settings: Partial<RoomSettings> = {},
): Room {
  return {
    code,
    status: "lobby",
    hostId: host.seatId,
    settings: { ...DEFAULT_ROOM_SETTINGS, ...settings },
    seats: [
      {
        kind: "human",
        id: host.seatId,
        name: host.name,
        avatar: ROLES[0],
        token: host.token,
        connected: true,
      },
    ],
  };
}

/** The first character nobody has taken yet; with 6 seats one look repeats. */
export function nextAvatar(room: Room): Role {
  const taken = new Set(room.seats.map((s) => s.avatar));
  return ROLES.find((r) => !taken.has(r)) ?? (ROLES[room.seats.length % ROLES.length] as Role);
}

export function seatByToken(room: Room, token: string) {
  return room.seats.find((s) => s.kind === "human" && s.token === token) ?? null;
}

/** No person is left: the server can close the room. */
export function isAbandoned(room: Room): boolean {
  return !room.seats.some((s) => s.kind === "human");
}

const fail = (error: ProtocolErrorCode): RoomResult => ({ ok: false, error });

export function applyRoomAction(room: Room, action: RoomAction): RoomResult {
  const seat = (id: PlayerId) => room.seats.find((s) => s.id === id);
  const ok = (next: Partial<Room>): RoomResult => ({ ok: true, room: { ...room, ...next } });
  const hostOnly = (by: PlayerId) => {
    if (!seat(by)) return fail("NOT_IN_ROOM");
    if (by !== room.hostId) return fail("NOT_HOST");
    if (room.status !== "lobby") return fail("GAME_IN_PROGRESS");
    return null;
  };

  switch (action.type) {
    case "join": {
      if (room.status !== "lobby") return fail("GAME_IN_PROGRESS");
      if (room.seats.length >= MAX_SEATS) return fail("ROOM_FULL");
      const joined: RoomSeat = {
        kind: "human",
        id: action.seatId,
        name: action.name,
        avatar: nextAvatar(room),
        token: action.token,
        connected: true,
      };
      return ok({ seats: [...room.seats, joined] });
    }

    case "leave": {
      const leaving = seat(action.seatId);
      if (leaving?.kind !== "human") return fail("NOT_IN_ROOM");
      // Mid-game the seat stays, so the game can go on; the server hands it to a bot.
      if (room.status === "playing") {
        return ok({
          seats: room.seats.map((s) => (s.id === leaving.id ? { ...s, connected: false } : s)),
        });
      }
      const seats = room.seats.filter((s) => s.id !== leaving.id);
      return ok({ seats, hostId: nextHost({ ...room, seats }, leaving.id) });
    }

    case "connection": {
      const target = seat(action.seatId);
      if (target?.kind !== "human") return fail("NOT_IN_ROOM");
      const seats = room.seats.map((s) =>
        s.id === target.id ? { ...target, connected: action.connected } : s,
      );
      return ok({ seats, hostId: nextHost({ ...room, seats }, null) });
    }

    case "addBot": {
      const refused = hostOnly(action.by);
      if (refused) return refused;
      if (room.seats.length >= MAX_SEATS) return fail("ROOM_FULL");
      const bot: RoomSeat = {
        kind: "bot",
        id: action.seatId,
        name: action.name,
        avatar: action.avatar,
      };
      return ok({ seats: [...room.seats, bot] });
    }

    case "removeBot": {
      const refused = hostOnly(action.by);
      if (refused) return refused;
      const target = seat(action.seatId);
      if (!target) return fail("NO_SUCH_SEAT");
      if (target.kind !== "bot") return fail("NOT_A_BOT");
      return ok({ seats: room.seats.filter((s) => s.id !== target.id) });
    }

    case "kick": {
      const refused = hostOnly(action.by);
      if (refused) return refused;
      const target = seat(action.seatId);
      if (!target) return fail("NO_SUCH_SEAT");
      if (target.kind !== "human" || target.id === action.by) return fail("CANNOT_KICK");
      return ok({ seats: room.seats.filter((s) => s.id !== target.id) });
    }

    case "settings": {
      const refused = hostOnly(action.by);
      if (refused) return refused;
      return ok({ settings: { ...room.settings, ...action.settings } });
    }

    case "start": {
      const refused = hostOnly(action.by);
      if (refused) return refused;
      if (room.seats.length < MIN_SEATS_TO_START) return fail("NOT_ENOUGH_PLAYERS");
      return ok({ status: "playing" });
    }

    case "finish":
      if (room.status !== "playing") return fail("NOT_PLAYING");
      return ok({ status: "finished" });
  }
}

/**
 * Who hosts after a change: the current host while they are still seated and connected,
 * otherwise the first connected person (or any person), so a room is never stuck without one.
 */
function nextHost(room: Room, leaving: PlayerId | null): PlayerId {
  const people = room.seats.filter((s) => s.kind === "human");
  const current = people.find((s) => s.id === room.hostId && s.id !== leaving);
  if (current?.connected) return current.id;
  const online = people.find((s) => s.connected);
  return (online ?? current ?? people[0])?.id ?? room.hostId;
}

/** What one seat may see of the room: everything but the session tokens. */
export function roomView(room: Room, you: PlayerId): RoomView {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    you,
    settings: room.settings,
    seats: room.seats.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      avatar: s.avatar,
      connected: s.kind === "bot" || s.connected,
    })),
  };
}

/** How to run the game this room just started (pace and timers from its settings). */
export function matchOptions(room: Room, seed: string): MatchOptions {
  const pace = PACES[room.settings.pace];
  const { actionTimeoutSeconds, botDifficulty } = room.settings;
  return {
    seed,
    speed: pace.speed,
    timeouts: {
      responseTimeoutMs: pace.responseTimeoutMs,
      choiceTimeoutMs: pace.choiceTimeoutMs,
      actionTimeoutMs: actionTimeoutSeconds > 0 ? actionTimeoutSeconds * 1000 : null,
    },
    seats: room.seats.map((s) => ({
      id: s.id,
      bot: s.kind === "bot" ? botFor(s.avatar, botDifficulty) : null,
    })),
  };
}
