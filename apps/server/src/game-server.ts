// Online rooms over Socket.IO (docs/architecture.md §5). The room rules live in packages/rooms and
// the game itself runs in a shared Match (packages/match); this file owns sockets, ids, tokens,
// timers and randomness, and makes sure each socket only ever sees its own seat's view.

import { randomBytes, randomInt } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  type EngineError,
  type GameEvent,
  getEventsForViewer,
  getLegalInputs,
  getPlayerView,
  type PlayerId,
} from "@chibi-bluff/engine";
import { Match } from "@chibi-bluff/match";
import {
  type AckFor,
  type ClientMessage,
  type ClientMessageName,
  type ClientToServerEvents,
  type ProtocolErrorCode,
  parseClientMessage,
  type ServerToClientEvents,
} from "@chibi-bluff/protocol";
import {
  applyRoomAction,
  createRoom,
  isAbandoned,
  matchOptions,
  nextAvatar,
  type Room,
  type RoomAction,
  roomCode,
  roomView,
  seatByToken,
} from "@chibi-bluff/rooms";
import { getTheme, type ThemeLocale } from "@chibi-bluff/themes";
import { Server, type Socket } from "socket.io";
import { Bucket, DEFAULT_LIMITS, type Limits } from "./rate-limit";

interface SocketData {
  code?: string;
  seatId?: PlayerId;
}

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type Timer = ReturnType<typeof setTimeout>;

interface LiveRoom {
  room: Room;
  /** Language bots are named in (the creator's). */
  locale: ThemeLocale;
  /** The socket currently sitting in each seat. */
  sockets: Map<PlayerId, AppSocket>;
  match: Match | null;
  /** Unredacted events of the current game, redacted per seat when (re)syncing. */
  events: GameEvent[];
  /** Lobby seats whose browser dropped, removed if it does not come back in time. */
  graceTimers: Map<PlayerId, Timer>;
  /** Since when no person has been connected, for cleanup. */
  idleSince: number | null;
}

export interface GameServerOptions {
  allowedOrigins: (string | RegExp)[];
  /** Rooms open at once (docs §5.4). */
  maxRooms?: number;
  /** How long a lobby seat waits for its browser to come back. */
  lobbyGraceMs?: number;
  /** Rooms with nobody connected are closed after this long (docs §5.4: 10 minutes). */
  idleRoomMs?: number;
  sweepMs?: number;
  /** Overrides the pace's speed (tests run games fast). */
  speed?: number;
  limits?: Partial<Limits>;
}

const MAX_EVENTS = 5_000;

export interface GameServer {
  http: HttpServer;
  io: AppServer;
  /** Starts listening; resolves with the port (useful with port 0). */
  listen(port: number): Promise<number>;
  /** Refuse new rooms and tell everyone the server is about to restart. */
  beginShutdown(): void;
  /** Games still in progress. */
  playing(): number;
  rooms(): number;
  close(): Promise<void>;
}

export function createGameServer(options: GameServerOptions): GameServer {
  const maxRooms = options.maxRooms ?? 500;
  const lobbyGraceMs = options.lobbyGraceMs ?? 60_000;
  const idleRoomMs = options.idleRoomMs ?? 10 * 60_000;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const rooms = new Map<string, LiveRoom>();
  let closing = false;

  const http = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size, closing }));
      return;
    }
    res.writeHead(404).end();
  });
  const io: AppServer = new Server(http, {
    cors: { origin: options.allowedOrigins },
    serveClient: false,
  });

  // ---------- Rooms ----------

  const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString("base64url")}`;
  const newToken = () => randomBytes(24).toString("base64url");
  const newCode = () => {
    for (;;) {
      const code = roomCode(() => randomInt(2 ** 30) / 2 ** 30);
      if (!rooms.has(code)) return code;
    }
  };

  function broadcastRoom(live: LiveRoom) {
    for (const [seatId, socket] of live.sockets) {
      socket.emit("room:state", roomView(live.room, seatId));
    }
  }

  /** Applies a room rule; on success the new room is broadcast. */
  function act(live: LiveRoom, action: RoomAction): ProtocolErrorCode | null {
    const result = applyRoomAction(live.room, action);
    if (!result.ok) return result.error;
    live.room = result.room;
    broadcastRoom(live);
    return null;
  }

  function closeRoom(live: LiveRoom) {
    live.match?.dispose();
    for (const timer of live.graceTimers.values()) clearTimeout(timer);
    for (const socket of live.sockets.values()) {
      socket.data = {};
      socket.leave(live.room.code);
    }
    rooms.delete(live.room.code);
  }

  function seat(live: LiveRoom, seatId: PlayerId, socket: AppSocket) {
    const previous = live.sockets.get(seatId);
    if (previous && previous !== socket) {
      // The same seat opened in another tab: the newest one wins.
      previous.data = {};
      previous.disconnect(true);
    }
    const timer = live.graceTimers.get(seatId);
    if (timer) clearTimeout(timer);
    live.graceTimers.delete(seatId);
    live.sockets.set(seatId, socket);
    socket.data = { code: live.room.code, seatId };
    socket.join(live.room.code);
    live.idleSince = null;
  }

  function unseat(live: LiveRoom, socket: AppSocket) {
    const { seatId } = socket.data;
    if (seatId && live.sockets.get(seatId) === socket) live.sockets.delete(seatId);
    socket.data = {};
    socket.leave(live.room.code);
  }

  function sync(live: LiveRoom, seatId: PlayerId, socket: AppSocket) {
    const { match } = live;
    if (!match) return;
    socket.emit("game:sync", {
      view: getPlayerView(match.state, seatId),
      legal: getLegalInputs(match.state, seatId),
      log: getEventsForViewer(live.events, seatId),
    });
  }

  function onGameEvents(live: LiveRoom, match: Match, events: GameEvent[]) {
    live.events.push(...events);
    if (live.events.length > MAX_EVENTS) live.events.splice(0, live.events.length - MAX_EVENTS);
    for (const [seatId, socket] of live.sockets) {
      socket.emit("game:update", {
        view: getPlayerView(match.state, seatId),
        legal: getLegalInputs(match.state, seatId),
        events: getEventsForViewer(events, seatId),
      });
    }
    if (events.some((e) => e.type === "GAME_OVER")) act(live, { type: "finish" });
  }

  function startGame(live: LiveRoom) {
    const setup = matchOptions(live.room, randomBytes(12).toString("hex"));
    if (options.speed !== undefined) setup.speed = options.speed;
    live.events = [];
    const match: Match = new Match(setup, (events) => onGameEvents(live, match, events));
    live.match = match;
    for (const [seatId, socket] of live.sockets) sync(live, seatId, socket);
    match.start();
  }

  /** A person stops being at the table: for good (`leave`) or until they reconnect. */
  function depart(socket: AppSocket, forGood: boolean) {
    const live = socket.data.code ? rooms.get(socket.data.code) : undefined;
    const seatId = socket.data.seatId;
    if (!live || !seatId) return;
    if (live.sockets.get(seatId) !== socket) {
      unseat(live, socket);
      return;
    }
    unseat(live, socket);
    if (forGood) {
      act(live, { type: "leave", seatId });
    } else {
      act(live, { type: "connection", seatId, connected: false });
      if (live.room.status === "lobby") {
        live.graceTimers.set(
          seatId,
          setTimeout(() => {
            live.graceTimers.delete(seatId);
            const still = live.room.seats.find((s) => s.id === seatId);
            if (still?.kind === "human" && !still.connected && live.room.status === "lobby") {
              act(live, { type: "leave", seatId });
              if (isAbandoned(live.room)) closeRoom(live);
            }
          }, lobbyGraceMs),
        );
      }
    }
    if (isAbandoned(live.room)) closeRoom(live);
  }

  // Close rooms nobody has been connected to for a while.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const live of [...rooms.values()]) {
      const anyone = live.room.seats.some((s) => s.kind === "human" && s.connected);
      if (anyone) live.idleSince = null;
      else if (live.idleSince === null) live.idleSince = now;
      else if (now - live.idleSince >= idleRoomMs) closeRoom(live);
    }
  }, options.sweepMs ?? 30_000);
  sweeper.unref();

  // ---------- Messages ----------

  io.on("connection", (socket) => {
    socket.data = {};
    const buckets = {
      room: new Bucket(limits.room.capacity, limits.room.perSecond),
      create: new Bucket(limits.create.capacity, limits.create.perSecond),
      input: new Bucket(limits.input.capacity, limits.input.perSecond),
      sticker: new Bucket(limits.sticker.capacity, limits.sticker.perSecond),
    };

    /** Registers a handler: rate limit, parse, then always answer the ack. */
    function on<N extends ClientMessageName>(
      name: N,
      bucket: Bucket,
      handle: (data: ClientMessage<N>) => AckFor<N>,
    ) {
      const listen = socket.on.bind(socket) as (
        event: string,
        listener: (payload: unknown, ack?: unknown) => void,
      ) => void;
      listen(name, (payload, ack) => {
        const reply = (r: AckFor<N>) => {
          if (typeof ack === "function") ack(r);
        };
        if (!bucket.take()) return reply({ ok: false, error: "RATE_LIMITED" });
        const parsed = parseClientMessage(name, payload);
        if (!parsed.ok) return reply({ ok: false, error: parsed.error });
        try {
          reply(handle(parsed.data));
        } catch (error) {
          console.error(`[${name}]`, error);
          reply({ ok: false, error: "BAD_REQUEST" });
        }
      });
    }

    /** The room and seat this socket sits in, if any. */
    const mine = () => {
      const live = socket.data.code ? rooms.get(socket.data.code) : undefined;
      const seatId = socket.data.seatId;
      return live && seatId && live.sockets.get(seatId) === socket ? { live, seatId } : null;
    };
    const refuse = (error: ProtocolErrorCode | EngineError) => ({ ok: false as const, error });

    on("room:create", buckets.create, (data) => {
      if (closing) return refuse("SERVER_CLOSING");
      if (rooms.size >= maxRooms) return refuse("TOO_MANY_ROOMS");
      depart(socket, true);
      const seatId = newId("p");
      const sessionToken = newToken();
      const room = createRoom(
        newCode(),
        { seatId, token: sessionToken, name: data.name },
        data.settings,
      );
      const live: LiveRoom = {
        room,
        locale: data.locale ?? "vi",
        sockets: new Map(),
        match: null,
        events: [],
        graceTimers: new Map(),
        idleSince: null,
      };
      rooms.set(room.code, live);
      seat(live, seatId, socket);
      broadcastRoom(live);
      return { ok: true, code: room.code, seatId, sessionToken };
    });

    on("room:join", buckets.room, (data) => {
      const live = rooms.get(data.code);
      if (!live) return refuse("ROOM_NOT_FOUND");
      // Coming back with a token: take the seat again, mid-game too.
      const returning = data.sessionToken ? seatByToken(live.room, data.sessionToken) : null;
      if (returning?.kind === "human") {
        if (socket.data.code !== live.room.code) depart(socket, true);
        seat(live, returning.id, socket);
        act(live, { type: "connection", seatId: returning.id, connected: true });
        sync(live, returning.id, socket);
        return {
          ok: true,
          code: live.room.code,
          seatId: returning.id,
          sessionToken: returning.token,
        };
      }
      const seatId = newId("p");
      const sessionToken = newToken();
      const result = applyRoomAction(live.room, {
        type: "join",
        seatId,
        token: sessionToken,
        name: data.name,
      });
      if (!result.ok) return refuse(result.error);
      depart(socket, true);
      live.room = result.room;
      seat(live, seatId, socket);
      broadcastRoom(live);
      return { ok: true, code: live.room.code, seatId, sessionToken };
    });

    on("room:leave", buckets.room, () => {
      if (!mine()) return refuse("NOT_IN_ROOM");
      depart(socket, true);
      return { ok: true };
    });

    on("room:settings", buckets.room, (data) => {
      const me = mine();
      if (!me) return refuse("NOT_IN_ROOM");
      const error = act(me.live, { type: "settings", by: me.seatId, settings: data.settings });
      return error ? refuse(error) : { ok: true };
    });

    on("room:addBot", buckets.room, () => {
      const me = mine();
      if (!me) return refuse("NOT_IN_ROOM");
      const avatar = nextAvatar(me.live.room);
      const theme = getTheme(me.live.room.settings.themeId);
      const error = act(me.live, {
        type: "addBot",
        by: me.seatId,
        seatId: newId("b"),
        name: theme.roles[avatar].botName[me.live.locale],
        avatar,
      });
      return error ? refuse(error) : { ok: true };
    });

    on("room:removeBot", buckets.room, (data) => {
      const me = mine();
      if (!me) return refuse("NOT_IN_ROOM");
      const error = act(me.live, { type: "removeBot", by: me.seatId, seatId: data.seatId });
      return error ? refuse(error) : { ok: true };
    });

    on("room:kick", buckets.room, (data) => {
      const me = mine();
      if (!me) return refuse("NOT_IN_ROOM");
      const target = me.live.sockets.get(data.seatId);
      const error = act(me.live, { type: "kick", by: me.seatId, seatId: data.seatId });
      if (error) return refuse(error);
      if (target) {
        target.emit("room:kicked", {});
        unseat(me.live, target);
      }
      return { ok: true };
    });

    on("room:start", buckets.room, () => {
      const me = mine();
      if (!me) return refuse("NOT_IN_ROOM");
      const error = act(me.live, { type: "start", by: me.seatId });
      if (error) return refuse(error);
      startGame(me.live);
      return { ok: true };
    });

    on("game:input", buckets.input, (data) => {
      const me = mine();
      if (!me) return refuse("NOT_IN_ROOM");
      const { match } = me.live;
      if (!match || me.live.room.status !== "playing") return refuse("NOT_PLAYING");
      // The seat comes from the socket, never from the message.
      const error = match.submit({ ...data.input, playerId: me.seatId });
      return error ? refuse(error) : { ok: true };
    });

    on("chat:sticker", buckets.sticker, (data) => {
      const me = mine();
      if (!me) return refuse("NOT_IN_ROOM");
      io.to(me.live.room.code).emit("chat:sticker", { seatId: me.seatId, sticker: data.sticker });
      return { ok: true };
    });

    socket.on("disconnect", () => depart(socket, false));
  });

  return {
    http,
    io,
    listen: (port) =>
      new Promise((resolve) => {
        http.listen(port, () => resolve((http.address() as AddressInfo).port));
      }),
    beginShutdown() {
      closing = true;
      io.emit("server:closing", {});
    },
    playing: () => [...rooms.values()].filter((r) => r.room.status === "playing").length,
    rooms: () => rooms.size,
    close: async () => {
      clearInterval(sweeper);
      for (const live of [...rooms.values()]) closeRoom(live);
      await io.close();
    },
  };
}
