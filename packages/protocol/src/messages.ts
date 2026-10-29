// Every message between the browser and the server (docs/architecture.md §5.2). Client messages
// are parsed with zod on the server; server messages carry engine data the server already
// redacted for the receiving seat, so they are typed but not re-validated.

import type {
  EngineError,
  GameEvent,
  PlayerId,
  PlayerInput,
  PlayerView,
  Role,
} from "@chibi-bluff/engine";
import { z } from "zod";
import {
  nameSchema,
  PROTOCOL_VERSION,
  playerInputSchema,
  type RoomSettings,
  roleSchema,
  roomCodeSchema,
  roomSettingsSchema,
  seatIdSchema,
  sessionTokenSchema,
} from "./schemas";

// ---------- Client → server ----------

const versioned = { protocolVersion: z.literal(PROTOCOL_VERSION) };
const empty = z.object({});

export const clientMessages = {
  /** Open a room and sit in it as its host. */
  "room:create": z.object({
    ...versioned,
    name: nameSchema,
    settings: roomSettingsSchema.partial().optional(),
    /** Language bots' names are given in. */
    locale: z.enum(["vi", "en"]).optional(),
  }),
  /** Sit in a room, or take your seat back with the token from an earlier join. */
  "room:join": z.object({
    ...versioned,
    code: roomCodeSchema,
    name: nameSchema,
    sessionToken: sessionTokenSchema.optional(),
  }),
  "room:leave": empty,
  /** Host only, in the lobby. */
  "room:settings": z.object({ settings: roomSettingsSchema.partial() }),
  "room:addBot": empty,
  "room:removeBot": z.object({ seatId: seatIdSchema }),
  "room:kick": z.object({ seatId: seatIdSchema }),
  "room:start": empty,
  /** The server fills in `playerId` from the socket's seat; whatever the client sent is ignored. */
  "game:input": z.object({ input: playerInputSchema }),
  "chat:sticker": z.object({ sticker: roleSchema }),
} as const;

export type ClientMessageName = keyof typeof clientMessages;
export type ClientMessage<N extends ClientMessageName> = z.infer<(typeof clientMessages)[N]>;

export const ERROR_CODES = [
  "BAD_REQUEST",
  "VERSION_MISMATCH",
  "RATE_LIMITED",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "GAME_IN_PROGRESS",
  "NOT_IN_ROOM",
  "NOT_HOST",
  "NOT_ENOUGH_PLAYERS",
  "NO_SUCH_SEAT",
  "NOT_A_BOT",
  "CANNOT_KICK",
  "NOT_PLAYING",
  /** Client side only: no answer from the server in time. */
  "SERVER_UNREACHABLE",
] as const;
export type ProtocolErrorCode = (typeof ERROR_CODES)[number];

/** Every client message is acknowledged; a refused one changes nothing. */
export type Ack<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: ProtocolErrorCode | EngineError };

/** Replies that carry data beyond `{ ok: true }`. */
export interface AckData {
  "room:create": { code: string; seatId: PlayerId; sessionToken: string };
  "room:join": { code: string; seatId: PlayerId; sessionToken: string };
}
export type AckFor<N extends ClientMessageName> = Ack<
  N extends keyof AckData ? AckData[N] : object
>;

/** Parses a client message. `protocolVersion` gets its own error so old tabs can ask to reload. */
export function parseClientMessage<N extends ClientMessageName>(
  name: N,
  payload: unknown,
): { ok: true; data: ClientMessage<N> } | { ok: false; error: ProtocolErrorCode } {
  const schema = clientMessages[name] as unknown as z.ZodType<ClientMessage<N>>;
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  const version = result.error.issues.some((i) => i.path[0] === "protocolVersion");
  return { ok: false, error: version ? "VERSION_MISMATCH" : "BAD_REQUEST" };
}

// ---------- Server → client ----------

export type RoomStatus = "lobby" | "playing" | "finished";

export interface SeatView {
  id: PlayerId;
  name: string;
  kind: "human" | "bot";
  avatar: Role;
  /** People only: whether their browser is connected right now. */
  connected: boolean;
  /** People only: a bot is playing this seat until they come back (docs §5.3). */
  standIn: boolean;
}

/** The lobby and table chrome as one seat sees it. Never contains session tokens. */
export interface RoomView {
  code: string;
  status: RoomStatus;
  hostId: PlayerId;
  /** The receiving seat. */
  you: PlayerId;
  settings: RoomSettings;
  seats: SeatView[];
}

/** Full game picture for one seat: on start, join or reconnect. */
export interface GameSync {
  view: PlayerView;
  legal: PlayerInput[];
  /** Redacted events since the game started, oldest first. */
  log: GameEvent[];
}

/** One batch of game changes for one seat. */
export interface GameUpdate {
  view: PlayerView;
  legal: PlayerInput[];
  /** Redacted events of this batch, for animations and the log. */
  events: GameEvent[];
}

export interface ServerMessages {
  "room:state": RoomView;
  "room:kicked": object;
  "game:sync": GameSync;
  "game:update": GameUpdate;
  "chat:sticker": { seatId: PlayerId; sticker: Role };
  /** Answer to a client `ping` (keep-alive). */
  pong: object;
}
export type ServerMessageName = keyof ServerMessages;

// ---------- WebSocket frames (docs/architecture.md §5.5) ----------
// `room:create` is an HTTP request (POST /rooms); every other client message travels over the
// room's WebSocket as a frame. A frame with an `id` gets exactly one reply frame with `re: id`.

/** Largest frame a client may send, in characters. */
export const MAX_FRAME_LENGTH = 4_096;

export const clientFrameSchema = z.object({
  id: z
    .number()
    .int()
    .nonnegative()
    .max(2 ** 31)
    .optional(),
  type: z.string().max(40),
  payload: z.unknown().optional(),
});
export type ClientFrame = z.infer<typeof clientFrameSchema>;

/** Messages a client may send over the WebSocket (`ping` needs no payload and no reply). */
export type SocketMessageName = Exclude<ClientMessageName, "room:create"> | "ping";

export type ServerFrame =
  | { re: number; reply: Ack<object> }
  | { [N in ServerMessageName]: { type: N; payload: ServerMessages[N] } }[ServerMessageName];
