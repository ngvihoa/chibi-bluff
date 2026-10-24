// Bot-vs-bot simulation: drives the engine the same way a host would, with per-seat views and
// redacted events. Used by tests and by the `pnpm bots:sim` CLI.

import {
  applyInput,
  createGame,
  createRng,
  DEFAULT_TIMEOUTS,
  type GameState,
  getEventsForViewer,
  getLegalInputs,
  getPlayerView,
  nextInt,
  type PlayerId,
  type RngState,
  shuffle,
} from "@chibi-bluff/engine";
import { createMemory, observe } from "../memory";
import type { BotMemory, BotPolicy, Decision, Personality } from "../types";

export interface SeatSpec {
  label: string;
  policy: BotPolicy;
  personality: Personality;
}

export interface GameResult {
  winner: string;
  turns: number;
}

const MAX_STEPS = 5_000;

export function simulateGame(
  seats: readonly SeatSpec[],
  seed: string,
  onDecision?: (state: GameState, seat: SeatSpec, decision: Decision) => void,
): GameResult {
  const ids: PlayerId[] = seats.map((_, i) => `p${i}`);
  const bySeat = new Map(ids.map((id, i) => [id, seats[i] as SeatSpec]));
  const created = createGame({ playerIds: ids, ...DEFAULT_TIMEOUTS }, seed, 0);
  let state = created.state;
  const memories = new Map<PlayerId, BotMemory>(
    ids.map((id) => [id, observe(createMemory(id, ids), getEventsForViewer(created.events, id))]),
  );
  const botRngs = new Map<PlayerId, RngState>(ids.map((id) => [id, createRng(`${seed}:${id}`)]));
  let order = createRng(`${seed}:order`);
  let now = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (state.phase.kind === "GAME_OVER") {
      return { winner: bySeat.get(state.phase.winnerId)?.label ?? "?", turns: state.turnNumber };
    }
    const actors = ids.filter((id) => getLegalInputs(state, id).length > 0);
    let actorIndex: number;
    [actorIndex, order] = nextInt(order, actors.length);
    const id = actors[actorIndex] as PlayerId;
    const seat = bySeat.get(id) as SeatSpec;

    const decision = seat.policy.decide({
      view: getPlayerView(state, id),
      legal: getLegalInputs(state, id),
      memory: memories.get(id) as BotMemory,
      personality: seat.personality,
      rng: botRngs.get(id) as RngState,
    });
    botRngs.set(id, decision.rng);
    onDecision?.(state, seat, decision);

    now += 1;
    const result = applyInput(state, decision.input, now);
    if (!result.ok) {
      throw new Error(
        `${seat.label} sent an illegal input (${result.error}): ${JSON.stringify(decision.input)}`,
      );
    }
    state = result.state;
    for (const viewer of ids) {
      memories.set(
        viewer,
        observe(memories.get(viewer) as BotMemory, getEventsForViewer(result.events, viewer)),
      );
    }
  }
  throw new Error(`Game ${seed} did not finish in ${MAX_STEPS} steps`);
}

export interface MatchResult {
  games: number;
  wins: Record<string, number>;
  /** Share of games won by seats with that label (labels may cover several seats). */
  winRate: Record<string, number>;
  averageTurns: number;
}

/** Plays many games, shuffling the seating each time so no label keeps a seat advantage. */
export function simulateMatch(
  seats: readonly SeatSpec[],
  games: number,
  seed = "match",
): MatchResult {
  const wins: Record<string, number> = Object.fromEntries(seats.map((s) => [s.label, 0]));

  let rng = createRng(seed);
  let turns = 0;
  for (let g = 0; g < games; g++) {
    let seating: SeatSpec[];
    [seating, rng] = shuffle(seats, rng);
    const result = simulateGame(seating, `${seed}-${g}`);
    wins[result.winner] = (wins[result.winner] ?? 0) + 1;
    turns += result.turns;
  }
  const winRate = Object.fromEntries(Object.entries(wins).map(([label, w]) => [label, w / games]));
  return { games, wins, winRate, averageTurns: turns / games };
}
