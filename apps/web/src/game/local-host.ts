// A game in the browser: the shared Match (engine + bots + timers, packages/match) seen from
// the one person at the table (docs/architecture.md §4.2).

import {
  type EngineError,
  type GameConfig,
  type GameEvent,
  getEventsForViewer,
  getLegalInputs,
  getPlayerView,
  type PlayerId,
  type PlayerInput,
} from "@chibi-bluff/engine";
import { type BotSeat, Match } from "@chibi-bluff/match";
import type { GameHost, HostSnapshot, SeatInfo } from "./host";

export type LocalSeat = SeatInfo & { bot?: BotSeat };

export interface LocalGameOptions {
  seats: LocalSeat[];
  seed: string;
  timeouts?: Partial<Omit<GameConfig, "playerIds">>;
  /** Multiplier for bot thinking time and pauses: >1 slower, <1 faster (tests use 0.1). */
  speed?: number;
}

const MAX_LOG = 300;

export class LocalHost implements GameHost {
  private readonly match: Match;
  private readonly seats: SeatInfo[];
  private readonly humanId: PlayerId | null;
  private readonly listeners = new Set<() => void>();
  private log: GameEvent[] = [];
  private snapshot: HostSnapshot;

  constructor(options: LocalGameOptions) {
    this.seats = options.seats.map(({ bot: _bot, ...info }) => info);
    this.humanId = options.seats.find((s) => s.kind === "human")?.id ?? null;
    this.match = new Match(
      {
        seats: options.seats.map((s) => ({ id: s.id, bot: s.bot })),
        seed: options.seed,
        timeouts: options.timeouts,
        speed: options.speed,
      },
      (events) => this.handle(events),
    );
    this.snapshot = this.buildSnapshot([]);
    this.match.start();
  }

  getSnapshot = (): HostSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  submit(input: PlayerInput): EngineError | null {
    if (input.playerId !== this.humanId) return "UNKNOWN_PLAYER";
    return this.match.submit(input);
  }

  dispose(): void {
    this.match.dispose();
    this.listeners.clear();
  }

  private handle(events: GameEvent[]): void {
    const mine = getEventsForViewer(events, this.humanId);
    this.log = [...this.log, ...mine].slice(-MAX_LOG);
    this.snapshot = this.buildSnapshot(mine);
    for (const listener of this.listeners) listener();
  }

  private buildSnapshot(latest: GameEvent[]): HostSnapshot {
    const { state } = this.match;
    return {
      seats: this.seats,
      view: getPlayerView(state, this.humanId),
      legal: this.humanId ? getLegalInputs(state, this.humanId) : [],
      log: this.log,
      latest,
    };
  }
}
