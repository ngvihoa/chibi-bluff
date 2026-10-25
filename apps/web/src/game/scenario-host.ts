// A GameHost over a hand-built game state, with no bots or timers. Dev-only: lets /dev/table
// show any table situation (e.g. a replacement pick) without waiting for it to happen in play.

import {
  applyInput,
  createDeck,
  createGame,
  DEFAULT_TIMEOUTS,
  type EngineError,
  type GameEvent,
  type GameState,
  getEventsForViewer,
  getLegalInputs,
  getPlayerView,
  type Input,
  type PlayerInput,
  type Role,
} from "@chibi-bluff/engine";
import type { GameHost, HostSnapshot, SeatInfo } from "./host";

export class ScenarioHost implements GameHost {
  private state: GameState;
  private log: GameEvent[] = [];
  private snapshot: HostSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly seats: SeatInfo[],
    state: GameState,
    private readonly viewerId: string,
  ) {
    this.state = state;
    this.snapshot = this.build([]);
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  submit(input: PlayerInput): EngineError | null {
    return this.apply(input);
  }
  dispose() {
    this.listeners.clear();
  }

  /** Drives any seat, for setting up a scenario. */
  apply(input: Input): EngineError | null {
    const result = applyInput(this.state, input, Date.now());
    if (!result.ok) return result.error;
    this.state = result.state;
    this.snapshot = this.build(getEventsForViewer(result.events, this.viewerId));
    for (const l of this.listeners) l();
    return null;
  }

  private build(latest: GameEvent[]): HostSnapshot {
    this.log = [...this.log, ...latest];
    return {
      seats: this.seats,
      view: getPlayerView(this.state, this.viewerId),
      legal: getLegalInputs(this.state, this.viewerId),
      log: this.log,
      latest,
    };
  }
}

/** A fresh game where each seat holds exactly the given cards, starting with `first`. */
export function stagedGame(hands: Record<string, Role[]>, first: string): GameState {
  const ids = Object.keys(hands);
  const { state } = createGame({ playerIds: ids, ...DEFAULT_TIMEOUTS }, "scenario", Date.now());
  const deck = createDeck();
  for (const roles of Object.values(hands)) {
    for (const role of roles) deck.splice(deck.indexOf(role), 1);
  }
  return {
    ...state,
    players: ids.map((id) => ({
      id,
      coins: 2,
      cards: (hands[id] ?? []).map((role) => ({ role, revealed: false })),
    })),
    deck,
    turn: { actorId: first, action: null, block: null },
  };
}
