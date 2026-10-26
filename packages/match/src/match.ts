// Runs one game: engine + bots, with timers for deadlines and bot "thinking" time, held back
// while the table plays a moment (docs/architecture.md §4.2). The browser (LocalHost) and the
// server run the same Match, so online rooms keep the pace of bot games. Bots see only their
// own PlayerView.

import { type BotMemory, createMemory, getBot, observe } from "@chibi-bluff/bots";
import {
  applyInput,
  createGame,
  createRng,
  DEFAULT_TIMEOUTS,
  type EngineError,
  type GameConfig,
  type GameEvent,
  type GameState,
  getEventsForViewer,
  getLegalInputs,
  getPlayerView,
  type Input,
  type PlayerId,
  type RngState,
} from "@chibi-bluff/engine";
import { momentPause } from "./pacing";
import type { BotSeat } from "./persona";

/** A seat in the match. Without `bot`, someone outside the match (a person) sends its inputs. */
export interface MatchSeat {
  id: PlayerId;
  bot?: BotSeat | null;
}

/** Time source; tests and the server may supply their own. */
export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const SYSTEM_CLOCK: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface MatchOptions {
  seats: MatchSeat[];
  seed: string;
  timeouts?: Partial<Omit<GameConfig, "playerIds">>;
  /** Multiplier for bot thinking time and pauses: >1 slower, <1 faster (tests use 0.1). */
  speed?: number;
  clock?: Clock;
}

interface Scheduled {
  phaseId: number;
  handle: unknown;
}

export class Match {
  private current: GameState;
  private readonly seats: Map<PlayerId, BotSeat | null>;
  private readonly memories = new Map<PlayerId, BotMemory>();
  private readonly botRngs = new Map<PlayerId, RngState>();
  private readonly botTimers = new Map<PlayerId, Scheduled>();
  private phaseTimer: Scheduled | null = null;
  private readonly clock: Clock;
  private readonly speed: number;
  private readonly seed: string;
  private pendingStart: GameEvent[] | null;
  private disposed = false;
  /** Bots wait until this time so players can watch the latest moment play out. */
  private holdUntil = 0;
  private lastPhaseId = 0;

  /** `onEvents` gets every batch of events (unredacted) after the state has moved on. */
  constructor(
    options: MatchOptions,
    private readonly onEvents: (events: GameEvent[]) => void,
  ) {
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.speed = options.speed ?? 1;
    this.seed = options.seed;
    this.seats = new Map(options.seats.map((s) => [s.id, s.bot ?? null]));
    const ids = options.seats.map((s) => s.id);
    const created = createGame(
      { playerIds: ids, ...DEFAULT_TIMEOUTS, ...options.timeouts },
      options.seed,
      this.clock.now(),
    );
    this.current = created.state;
    this.pendingStart = created.events;
    // Every seat keeps a memory, so a bot can take over a seat mid-game (docs §5.3).
    for (const id of ids) this.memories.set(id, createMemory(id, ids));
  }

  /** Emits the opening events and lets bots and timers run. Separate from the constructor so the
   * owner can be fully set up before the first `onEvents` call. */
  start(): void {
    if (!this.pendingStart) return;
    const events = this.pendingStart;
    this.pendingStart = null;
    this.handle(events);
  }

  get state(): GameState {
    return this.current;
  }

  /** Seats a person currently controls (not a bot). */
  get humans(): ReadonlySet<PlayerId> {
    return new Set([...this.seats].filter(([, bot]) => !bot).map(([id]) => id));
  }

  /** Input from a person. Seats driven by a bot refuse outside input. */
  submit(input: Input): EngineError | null {
    if (input.type !== "TIMEOUT") {
      if (!this.seats.has(input.playerId)) return "UNKNOWN_PLAYER";
      if (this.seats.get(input.playerId)) return "NOT_YOUR_TURN";
    }
    return this.apply(input);
  }

  /** Hands a seat to a bot (e.g. a player dropped out) or back to its person (`null`). */
  setBot(id: PlayerId, bot: BotSeat | null): void {
    if (!this.seats.has(id)) return;
    this.seats.set(id, bot);
    const queued = this.botTimers.get(id);
    if (queued) this.clock.clearTimeout(queued.handle);
    this.botTimers.delete(id);
    if (!this.pendingStart) this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  // ---------- Internals ----------

  private apply(input: Input): EngineError | null {
    if (this.disposed) return "GAME_OVER";
    const result = applyInput(this.current, input, this.clock.now());
    if (!result.ok) return result.error;
    this.current = result.state;
    this.handle(result.events);
    return null;
  }

  private handle(events: GameEvent[]): void {
    for (const [id, memory] of this.memories) {
      this.memories.set(id, observe(memory, getEventsForViewer(events, id)));
    }
    const now = this.clock.now();
    const pause = momentPause(events, this.humans) * this.speed;
    this.holdUntil = Math.max(this.holdUntil, now + pause);
    // The clock must not run while a moment is playing: a phase that opened during this batch
    // gets its deadline pushed back by the pause. The match owns time, so it may adjust it.
    const { phase } = this.current;
    if (pause > 0 && this.current.phaseId !== this.lastPhaseId && phase.deadline !== null) {
      this.current = { ...this.current, phase: { ...phase, deadline: phase.deadline + pause } };
    }
    this.lastPhaseId = this.current.phaseId;
    this.onEvents(events);
    this.schedule();
  }

  private schedule(): void {
    if (this.disposed) return;
    const state = this.current;
    if (state.phase.kind === "GAME_OVER") {
      this.clearTimers();
      return;
    }

    // Phase deadline → TIMEOUT (R-DG-1 / R-DG-3).
    if (this.phaseTimer?.phaseId !== state.phaseId) {
      if (this.phaseTimer) this.clock.clearTimeout(this.phaseTimer.handle);
      this.phaseTimer = null;
      const { deadline } = state.phase;
      if (deadline !== null) {
        const phaseId = state.phaseId;
        const handle = this.clock.setTimeout(
          () => {
            if (this.current.phaseId === phaseId) this.apply({ type: "TIMEOUT" });
          },
          Math.max(0, deadline - this.clock.now()),
        );
        this.phaseTimer = { phaseId, handle };
      }
    }

    // Bots decide now, act after their thinking delay. A bot that already has a move queued for
    // this phase keeps it; the engine rejects anything that became stale (phaseId check).
    for (const [id, bot] of this.seats) {
      if (!bot) continue;
      const legal = getLegalInputs(state, id);
      const queued = this.botTimers.get(id);
      if (legal.length === 0) {
        if (queued) this.clock.clearTimeout(queued.handle);
        this.botTimers.delete(id);
        continue;
      }
      if (queued?.phaseId === state.phaseId) continue;
      if (queued) this.clock.clearTimeout(queued.handle);

      const decision = getBot(bot.difficulty).decide({
        view: getPlayerView(state, id),
        legal,
        memory: this.memories.get(id) as BotMemory,
        personality: bot.personality,
        rng: this.botRng(id),
      });
      this.botRngs.set(id, decision.rng);
      const phaseId = state.phaseId;
      const handle = this.clock.setTimeout(
        () => {
          this.botTimers.delete(id);
          // Should not happen (same phase, legal input), but never leave a bot stuck.
          if (this.apply({ ...decision.input, phaseId })) this.schedule();
        },
        Math.max(0, this.holdUntil - this.clock.now()) + decision.thinkMs * this.speed,
      );
      this.botTimers.set(id, { phaseId, handle });
    }
  }

  private botRng(id: PlayerId): RngState {
    let rng = this.botRngs.get(id);
    if (!rng) {
      rng = createRng(`${this.seed}:${id}`);
      this.botRngs.set(id, rng);
    }
    return rng;
  }

  private clearTimers(): void {
    if (this.phaseTimer) this.clock.clearTimeout(this.phaseTimer.handle);
    this.phaseTimer = null;
    for (const { handle } of this.botTimers.values()) this.clock.clearTimeout(handle);
    this.botTimers.clear();
  }
}
