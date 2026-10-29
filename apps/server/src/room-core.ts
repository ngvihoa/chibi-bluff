// One online room (docs/architecture.md §5): who sits where, the lobby, and the game. The room
// rules live in packages/rooms and the game runs in a shared Match (packages/match); this class
// owns connections, ids, tokens and timers, and makes sure each connection only ever sees its
// own seat's view. It knows nothing about Cloudflare: the Durable Object (room-object.ts) feeds
// it WebSocket messages, and tests feed it fake connections.

import {
  type EngineError,
  type GameEvent,
  getEventsForViewer,
  getLegalInputs,
  getPlayerView,
  type PlayerId,
} from "@chibi-bluff/engine";
import { botFor, Match, type MatchSnapshot } from "@chibi-bluff/match";
import {
  type Ack,
  type AckFor,
  type ClientMessage,
  type ClientMessageName,
  clientFrameSchema,
  MAX_FRAME_LENGTH,
  type ProtocolErrorCode,
  parseClientMessage,
  type ServerFrame,
} from "@chibi-bluff/protocol";
import {
  applyRoomAction,
  createRoom,
  isAbandoned,
  matchOptions,
  nextAvatar,
  type Room,
  type RoomAction,
  roomView,
  seatByToken,
} from "@chibi-bluff/rooms";
import { getTheme, type ThemeLocale } from "@chibi-bluff/themes";
import { newId, newSeed, newToken } from "./ids";
import { Bucket, DEFAULT_LIMITS, type Limits } from "./rate-limit";

/** A WebSocket, or a fake one in tests. */
export interface Connection {
  send(frame: ServerFrame): void;
  close(code?: number, reason?: string): void;
}

export interface RoomCoreOptions {
  /** How long a lobby seat waits for its browser to come back. */
  lobbyGraceMs?: number;
  /** Mid-game, how long before a bot plays for someone who dropped out (docs §5.3: 30 s). */
  standInMs?: number;
  /** A room nobody has been connected to for this long is closed (docs §5.4: 10 minutes). */
  idleRoomMs?: number;
  /** Overrides the pace's speed (tests run games fast). */
  speed?: number;
  limits?: Partial<Limits>;
}

/** A room as plain data, for storage (docs/architecture.md §5.5). */
export interface RoomSnapshot {
  room: Room;
  locale: ThemeLocale;
  events: GameEvent[];
  match: MatchSnapshot | null;
}

/** How a room keeps itself across restarts. Without hooks (tests), it lives in memory only. */
export interface RoomHooks {
  /** The room changed: store this snapshot, or forget the room (`null`). */
  save?(snapshot: RoomSnapshot | null): void;
  /** Wake the room at this time to close it if nobody came back; `null` cancels. A Durable
   * Object uses its alarm, which survives the object being evicted. */
  setIdleAlarm?(at: number | null): void;
}

interface Session {
  seatId: PlayerId | null;
  buckets: { room: Bucket; input: Bucket; sticker: Bucket };
}

type Timer = ReturnType<typeof setTimeout>;
type Reply = Ack<object>;

const MAX_EVENTS = 5_000;

export class RoomCore {
  private room: Room | null = null;
  /** Language bots are named in (the creator's). */
  private locale: ThemeLocale = "vi";
  private readonly sessions = new Map<Connection, Session>();
  /** The connection currently sitting in each seat. */
  private readonly seated = new Map<PlayerId, Connection>();
  private match: Match | null = null;
  /** Unredacted events of the current game, redacted per seat when (re)syncing. */
  private events: GameEvent[] = [];
  /** Seats whose browser dropped: freed (lobby) or handed to a bot (mid-game) if it does not
   * come back in time. */
  private readonly graceTimers = new Map<PlayerId, Timer>();
  private idleTimer: Timer | null = null;
  private readonly lobbyGraceMs: number;
  private readonly standInMs: number;
  private readonly idleRoomMs: number;
  private readonly limits: Limits;

  /** A change is waiting to be saved (several changes in one go are saved once). */
  private dirty = false;

  constructor(
    private readonly options: RoomCoreOptions = {},
    private readonly hooks: RoomHooks = {},
  ) {
    this.lobbyGraceMs = options.lobbyGraceMs ?? 60_000;
    this.standInMs = options.standInMs ?? 30_000;
    this.idleRoomMs = options.idleRoomMs ?? 10 * 60_000;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
  }

  /** The room exists (created and not closed). */
  get isOpen(): boolean {
    return this.room !== null;
  }

  get status() {
    return this.room?.status ?? null;
  }

  /** Opens the room with its host (`POST /rooms`). Null if this code is already in use. */
  create(code: string, data: ClientMessage<"room:create">): AckFor<"room:create"> | null {
    if (this.room) return null;
    const seatId = newId("p");
    const sessionToken = newToken();
    this.room = createRoom(code, { seatId, token: sessionToken, name: data.name }, data.settings);
    this.locale = data.locale ?? "vi";
    // The host has not connected yet: their seat waits like any dropped lobby seat.
    this.room = { ...this.room, seats: this.room.seats.map((s) => ({ ...s, connected: false })) };
    this.holdSeat(seatId);
    this.armIdle();
    this.changed();
    return { ok: true, code, seatId, sessionToken };
  }

  /** The room as plain data, or null if there is none. */
  snapshot(): RoomSnapshot | null {
    if (!this.room) return null;
    return {
      room: this.room,
      locale: this.locale,
      events: this.events,
      match: this.match?.snapshot() ?? null,
    };
  }

  /**
   * Picks the room up after a restart (deploy, eviction). Nobody is connected yet: every person
   * gets the usual time to come back before their lobby seat is freed or a bot stands in, and the
   * game's clock moved on only by the time it was actually running.
   */
  restore(snapshot: RoomSnapshot): void {
    if (this.room) return;
    this.room = {
      ...snapshot.room,
      seats: snapshot.room.seats.map((s) => (s.kind === "human" ? { ...s, connected: false } : s)),
    };
    this.locale = snapshot.locale;
    this.events = snapshot.events;
    if (snapshot.match) {
      const match: Match = Match.restore(snapshot.match, (events) =>
        this.onGameEvents(match, events),
      );
      this.match = match;
    }
    for (const seat of this.room.seats) {
      if (seat.kind === "human" && !seat.standIn) this.holdSeat(seat.id);
    }
    this.armIdle();
  }

  /** The idle alarm went off: close the room unless someone is back. */
  expireIfIdle(): void {
    if (this.room && this.seated.size === 0) this.close();
  }

  connect(connection: Connection): void {
    this.sessions.set(connection, {
      seatId: null,
      buckets: {
        room: new Bucket(this.limits.room.capacity, this.limits.room.perSecond),
        input: new Bucket(this.limits.input.capacity, this.limits.input.perSecond),
        sticker: new Bucket(this.limits.sticker.capacity, this.limits.sticker.perSecond),
      },
    });
  }

  /** A text frame from a connection: parse, rate-limit, handle, and answer if asked to. */
  receive(connection: Connection, raw: string): void {
    const session = this.sessions.get(connection);
    if (!session) return;
    const frame = raw.length <= MAX_FRAME_LENGTH ? safeJson(raw) : null;
    const parsed = clientFrameSchema.safeParse(frame);
    if (!parsed.success) {
      const id = (frame as { id?: unknown } | null)?.id;
      if (typeof id === "number") connection.send({ re: id, reply: refuse("BAD_REQUEST") });
      return;
    }
    const { id, type, payload } = parsed.data;
    if (type === "ping") {
      connection.send({ type: "pong", payload: {} });
      return;
    }
    let reply: Reply;
    try {
      reply = this.handle(connection, session, type, payload);
    } catch (error) {
      console.error(`[${type}]`, error);
      reply = refuse("BAD_REQUEST");
    }
    if (id !== undefined) connection.send({ re: id, reply });
  }

  /** The connection closed (tab closed, network gone): the seat waits for its person. */
  disconnect(connection: Connection): void {
    this.depart(connection, false);
    this.sessions.delete(connection);
  }

  dispose(): void {
    this.close();
  }

  // ---------- Messages ----------

  private handle(connection: Connection, session: Session, type: string, payload: unknown): Reply {
    const parse = <N extends ClientMessageName>(
      name: N,
      bucket: Bucket,
    ): { ok: true; data: ClientMessage<N> } | { ok: false; error: ProtocolErrorCode } => {
      if (!bucket.take()) return { ok: false, error: "RATE_LIMITED" };
      return parseClientMessage(name, payload ?? {});
    };
    const { buckets } = session;
    const mine = () => {
      const seatId = session.seatId;
      return this.room && seatId && this.seated.get(seatId) === connection ? seatId : null;
    };

    switch (type) {
      case "room:join": {
        const msg = parse("room:join", buckets.room);
        if (!msg.ok) return refuse(msg.error);
        return this.join(connection, session, msg.data);
      }
      case "room:leave": {
        const msg = parse("room:leave", buckets.room);
        if (!msg.ok) return refuse(msg.error);
        if (!mine()) return refuse("NOT_IN_ROOM");
        this.depart(connection, true);
        return { ok: true };
      }
      case "room:settings": {
        const msg = parse("room:settings", buckets.room);
        if (!msg.ok) return refuse(msg.error);
        const by = mine();
        if (!by) return refuse("NOT_IN_ROOM");
        return result(this.act({ type: "settings", by, settings: msg.data.settings }));
      }
      case "room:addBot": {
        const msg = parse("room:addBot", buckets.room);
        if (!msg.ok) return refuse(msg.error);
        const by = mine();
        if (!by || !this.room) return refuse("NOT_IN_ROOM");
        const avatar = nextAvatar(this.room);
        const theme = getTheme(this.room.settings.themeId);
        return result(
          this.act({
            type: "addBot",
            by,
            seatId: newId("b"),
            name: theme.roles[avatar].botName[this.locale],
            avatar,
          }),
        );
      }
      case "room:removeBot": {
        const msg = parse("room:removeBot", buckets.room);
        if (!msg.ok) return refuse(msg.error);
        const by = mine();
        if (!by) return refuse("NOT_IN_ROOM");
        return result(this.act({ type: "removeBot", by, seatId: msg.data.seatId }));
      }
      case "room:kick": {
        const msg = parse("room:kick", buckets.room);
        if (!msg.ok) return refuse(msg.error);
        const by = mine();
        if (!by) return refuse("NOT_IN_ROOM");
        const target = this.seated.get(msg.data.seatId);
        const error = this.act({ type: "kick", by, seatId: msg.data.seatId });
        if (error) return refuse(error);
        if (target) {
          target.send({ type: "room:kicked", payload: {} });
          this.unseat(target);
        }
        return { ok: true };
      }
      case "room:start": {
        const msg = parse("room:start", buckets.room);
        if (!msg.ok) return refuse(msg.error);
        const by = mine();
        if (!by) return refuse("NOT_IN_ROOM");
        const error = this.act({ type: "start", by });
        if (error) return refuse(error);
        this.startGame();
        return { ok: true };
      }
      case "game:input": {
        const msg = parse("game:input", buckets.input);
        if (!msg.ok) return refuse(msg.error);
        const seatId = mine();
        if (!seatId) return refuse("NOT_IN_ROOM");
        if (!this.match || this.room?.status !== "playing") return refuse("NOT_PLAYING");
        // The seat comes from the connection, never from the message.
        const error = this.match.submit({ ...msg.data.input, playerId: seatId });
        return error ? refuse(error) : { ok: true };
      }
      case "chat:sticker": {
        const msg = parse("chat:sticker", buckets.sticker);
        if (!msg.ok) return refuse(msg.error);
        const seatId = mine();
        if (!seatId) return refuse("NOT_IN_ROOM");
        for (const target of this.seated.values()) {
          target.send({ type: "chat:sticker", payload: { seatId, sticker: msg.data.sticker } });
        }
        return { ok: true };
      }
      default:
        // `room:create` is an HTTP request, never a frame.
        return refuse("BAD_REQUEST");
    }
  }

  private join(
    connection: Connection,
    session: Session,
    data: ClientMessage<"room:join">,
  ): AckFor<"room:join"> {
    const room = this.room;
    if (!room || room.code !== data.code) return refuse("ROOM_NOT_FOUND");
    // Coming back with a token: take the seat again, mid-game too.
    const returning = data.sessionToken ? seatByToken(room, data.sessionToken) : null;
    if (returning?.kind === "human") {
      if (session.seatId && session.seatId !== returning.id) this.depart(connection, true);
      this.seat(connection, returning.id);
      // Back in time or not, the person takes the seat over from any stand-in bot.
      this.match?.setBot(returning.id, null);
      this.act({ type: "connection", seatId: returning.id, connected: true });
      this.sync(returning.id, connection);
      return { ok: true, code: room.code, seatId: returning.id, sessionToken: returning.token };
    }
    const seatId = newId("p");
    const sessionToken = newToken();
    const joined = applyRoomAction(room, {
      type: "join",
      seatId,
      token: sessionToken,
      name: data.name,
    });
    if (!joined.ok) return refuse(joined.error);
    if (session.seatId) this.depart(connection, true);
    this.room = joined.room;
    this.seat(connection, seatId);
    this.broadcastRoom();
    this.changed();
    return { ok: true, code: room.code, seatId, sessionToken };
  }

  // ---------- Room ----------

  private broadcastRoom() {
    if (!this.room) return;
    for (const [seatId, connection] of this.seated) {
      connection.send({ type: "room:state", payload: roomView(this.room, seatId) });
    }
  }

  /** Applies a room rule; on success the new room is broadcast. */
  private act(action: RoomAction): ProtocolErrorCode | null {
    if (!this.room) return "ROOM_NOT_FOUND";
    const next = applyRoomAction(this.room, action);
    if (!next.ok) return next.error;
    this.room = next.room;
    this.broadcastRoom();
    this.changed();
    return null;
  }

  private seat(connection: Connection, seatId: PlayerId) {
    const previous = this.seated.get(seatId);
    if (previous && previous !== connection) {
      // The same seat opened in another tab: the newest one wins.
      this.unseat(previous);
      previous.close(4000, "seat taken by another tab");
    }
    const timer = this.graceTimers.get(seatId);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(seatId);
    this.seated.set(seatId, connection);
    const session = this.sessions.get(connection);
    if (session) session.seatId = seatId;
    this.disarmIdle();
  }

  private unseat(connection: Connection) {
    const session = this.sessions.get(connection);
    const seatId = session?.seatId;
    if (seatId && this.seated.get(seatId) === connection) this.seated.delete(seatId);
    if (session) session.seatId = null;
  }

  private sync(seatId: PlayerId, connection: Connection) {
    const { match } = this;
    if (!match) return;
    connection.send({
      type: "game:sync",
      payload: {
        view: getPlayerView(match.state, seatId),
        legal: getLegalInputs(match.state, seatId),
        log: getEventsForViewer(this.events, seatId),
      },
    });
  }

  private onGameEvents(match: Match, events: GameEvent[]) {
    this.events.push(...events);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
    for (const [seatId, connection] of this.seated) {
      connection.send({
        type: "game:update",
        payload: {
          view: getPlayerView(match.state, seatId),
          legal: getLegalInputs(match.state, seatId),
          events: getEventsForViewer(events, seatId),
        },
      });
    }
    if (events.some((e) => e.type === "GAME_OVER")) this.act({ type: "finish" });
    this.changed();
  }

  private startGame() {
    if (!this.room) return;
    const setup = matchOptions(this.room, newSeed());
    if (this.options.speed !== undefined) setup.speed = this.options.speed;
    this.events = [];
    const match: Match = new Match(setup, (events) => this.onGameEvents(match, events));
    this.match = match;
    for (const [seatId, connection] of this.seated) this.sync(seatId, connection);
    match.start();
    this.changed();
  }

  /** A bot (Normal) plays for a person who is away, until they come back (docs §5.3). */
  private standIn(seatId: PlayerId) {
    const away = this.room?.seats.find((s) => s.id === seatId);
    if (!this.match || away?.kind !== "human" || this.room?.status !== "playing") return;
    this.match.setBot(seatId, botFor(away.avatar, "normal"));
    this.act({ type: "standIn", seatId, on: true });
  }

  /** A person stops being at the table: for good (`leave`) or until they reconnect. */
  private depart(connection: Connection, forGood: boolean) {
    const seatId = this.sessions.get(connection)?.seatId;
    if (!this.room || !seatId) return;
    if (this.seated.get(seatId) !== connection) {
      this.unseat(connection);
      return;
    }
    this.unseat(connection);
    if (forGood) {
      this.act({ type: "leave", seatId });
      // Mid-game the seat stays: a bot finishes the game for them right away.
      this.standIn(seatId);
    } else {
      this.act({ type: "connection", seatId, connected: false });
      this.holdSeat(seatId);
    }
    if (this.room && isAbandoned(this.room)) this.close();
    else if (this.seated.size === 0) this.armIdle();
  }

  /** Gives a dropped seat time to come back before it is freed (lobby) or stood in for (game). */
  private holdSeat(seatId: PlayerId) {
    const status = this.room?.status;
    if (status !== "lobby" && status !== "playing") return;
    const timer = setTimeout(
      () => {
        this.graceTimers.delete(seatId);
        const still = this.room?.seats.find((s) => s.id === seatId);
        if (still?.kind !== "human" || still.connected) return;
        if (this.room?.status === "lobby") {
          this.act({ type: "leave", seatId });
          if (this.room && isAbandoned(this.room)) this.close();
        } else {
          this.standIn(seatId);
        }
      },
      status === "lobby" ? this.lobbyGraceMs : this.standInMs,
    );
    this.graceTimers.set(seatId, timer);
  }

  /** Closes the room if nobody connects for a while. */
  private armIdle() {
    this.disarmIdle();
    if (this.hooks.setIdleAlarm) this.hooks.setIdleAlarm(Date.now() + this.idleRoomMs);
    else this.idleTimer = setTimeout(() => this.expireIfIdle(), this.idleRoomMs);
  }

  private disarmIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.hooks.setIdleAlarm?.(null);
  }

  /** Saves once the current burst of changes is over (a turn can change the room many times). */
  private changed() {
    if (!this.hooks.save || this.dirty) return;
    this.dirty = true;
    queueMicrotask(() => {
      this.dirty = false;
      this.hooks.save?.(this.snapshot());
    });
  }

  /** The room is gone: later joins get ROOM_NOT_FOUND. Connections stay open but seatless. */
  private close() {
    this.match?.dispose();
    this.match = null;
    for (const timer of this.graceTimers.values()) clearTimeout(timer);
    this.graceTimers.clear();
    this.disarmIdle();
    for (const connection of [...this.seated.values()]) this.unseat(connection);
    this.room = null;
    this.events = [];
    this.changed();
  }
}

const refuse = (error: ProtocolErrorCode | EngineError) => ({ ok: false as const, error });
const result = (error: ProtocolErrorCode | null): Reply => (error ? refuse(error) : { ok: true });

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
