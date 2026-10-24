// Runs a whole game in the browser: engine + bots, with timers for response windows and bot
// "thinking" time (docs/architecture.md §4.2). Bots see only their own PlayerView.

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
  type PlayerInput,
  type RngState,
} from "@chibi-bluff/engine";
import type { BotSeat, GameHost, HostSnapshot, SeatInfo } from "./host";

export type LocalSeat = SeatInfo & { bot?: BotSeat };

export interface LocalGameOptions {
  seats: LocalSeat[];
  seed: string;
  timeouts?: Partial<Omit<GameConfig, "playerIds">>;
}

const MAX_LOG = 300;

interface Scheduled {
  phaseId: number;
  timer: ReturnType<typeof setTimeout>;
}

export class LocalHost implements GameHost {
  private state: GameState;
  private readonly seats: LocalSeat[];
  private readonly humanId: PlayerId | null;
  private readonly memories = new Map<PlayerId, BotMemory>();
  private readonly botRngs = new Map<PlayerId, RngState>();
  private readonly botTimers = new Map<PlayerId, Scheduled>();
  private phaseTimer: Scheduled | null = null;
  private readonly listeners = new Set<() => void>();
  private log: GameEvent[] = [];
  private snapshot: HostSnapshot;
  private disposed = false;

  constructor(options: LocalGameOptions) {
    this.seats = options.seats;
    this.humanId = options.seats.find((s) => s.kind === "human")?.id ?? null;
    const ids = options.seats.map((s) => s.id);
    const created = createGame(
      { playerIds: ids, ...DEFAULT_TIMEOUTS, ...options.timeouts },
      options.seed,
      Date.now(),
    );
    this.state = created.state;
    for (const seat of options.seats) {
      if (seat.kind !== "bot") continue;
      this.memories.set(seat.id, createMemory(seat.id, ids));
      this.botRngs.set(seat.id, createRng(`${options.seed}:${seat.id}`));
    }
    this.snapshot = this.buildSnapshot([]);
    this.handle(created.events);
  }

  getSnapshot = (): HostSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  submit(input: PlayerInput): EngineError | null {
    if (input.playerId !== this.humanId) return "UNKNOWN_PLAYER";
    return this.apply(input);
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
    this.listeners.clear();
  }

  // ---------- Internals ----------

  private apply(input: Input): EngineError | null {
    if (this.disposed) return "GAME_OVER";
    const result = applyInput(this.state, input, Date.now());
    if (!result.ok) return result.error;
    this.state = result.state;
    this.handle(result.events);
    return null;
  }

  private handle(events: GameEvent[]): void {
    for (const [id, memory] of this.memories) {
      this.memories.set(id, observe(memory, getEventsForViewer(events, id)));
    }
    const mine = getEventsForViewer(events, this.humanId);
    this.log = [...this.log, ...mine].slice(-MAX_LOG);
    this.snapshot = this.buildSnapshot(mine);
    for (const listener of this.listeners) listener();
    this.schedule();
  }

  private buildSnapshot(latest: GameEvent[]): HostSnapshot {
    return {
      seats: this.seats.map(({ bot: _bot, ...info }) => info),
      view: getPlayerView(this.state, this.humanId),
      legal: this.humanId ? getLegalInputs(this.state, this.humanId) : [],
      log: this.log,
      latest,
    };
  }

  private schedule(): void {
    if (this.disposed) return;
    const { state } = this;
    if (state.phase.kind === "GAME_OVER") {
      this.clearTimers();
      return;
    }

    // Phase deadline → TIMEOUT (R-DG-1 / R-DG-3).
    if (this.phaseTimer?.phaseId !== state.phaseId) {
      if (this.phaseTimer) clearTimeout(this.phaseTimer.timer);
      this.phaseTimer = null;
      const { deadline } = state.phase;
      if (deadline !== null) {
        const phaseId = state.phaseId;
        const timer = setTimeout(
          () => {
            if (this.state.phaseId === phaseId) this.apply({ type: "TIMEOUT" });
          },
          Math.max(0, deadline - Date.now()),
        );
        this.phaseTimer = { phaseId, timer };
      }
    }

    // Bots decide now, act after their thinking delay. A bot that already has a move queued for
    // this phase keeps it; the engine rejects anything that became stale (phaseId check).
    for (const seat of this.seats) {
      if (seat.kind !== "bot" || !seat.bot) continue;
      const legal = getLegalInputs(state, seat.id);
      const queued = this.botTimers.get(seat.id);
      if (legal.length === 0) {
        if (queued) clearTimeout(queued.timer);
        this.botTimers.delete(seat.id);
        continue;
      }
      if (queued?.phaseId === state.phaseId) continue;
      if (queued) clearTimeout(queued.timer);

      const decision = getBot(seat.bot.difficulty).decide({
        view: getPlayerView(state, seat.id),
        legal,
        memory: this.memories.get(seat.id) as BotMemory,
        personality: seat.bot.personality,
        rng: this.botRngs.get(seat.id) as RngState,
      });
      this.botRngs.set(seat.id, decision.rng);
      const phaseId = state.phaseId;
      const timer = setTimeout(() => {
        this.botTimers.delete(seat.id);
        // Should not happen (same phase, legal input), but never leave a bot stuck.
        if (this.apply({ ...decision.input, phaseId })) this.schedule();
      }, decision.thinkMs);
      this.botTimers.set(seat.id, { phaseId, timer });
    }
  }

  private clearTimers(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer.timer);
    this.phaseTimer = null;
    for (const { timer } of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();
  }
}
