// Thinking ahead in imagined worlds (docs/bot-ai.md §7.3): ISMCTS, and PIMC as the baseline it is
// measured against. Both guess the hidden cards (guess.ts), rebuild a world from the bot's own view
// (engine `determinize`), and play on with the quick policy (playout.ts).

import {
  determinize,
  nextRandom as nextRoll,
  type PlayerId,
  type PlayerInput,
  type PlayerView,
  type RngState,
} from "@chibi-bluff/engine";
import type { BotMemory } from "../types";
import { guessWorld } from "./guess";
import { apply, evaluate, nextDecider, playout, quickInput } from "./playout";

export interface SearchOptions {
  /** Stop after this long (ms). */
  timeMs: number;
  /** Or after this many iterations, whichever comes first (tests use it to be deterministic). */
  maxIterations: number;
  /** Turns the quick policy plays on before the position is scored. */
  rolloutTurns: number;
  /** The clock (ms); injectable for tests. */
  now: () => number;
}

export interface SearchResult {
  /** Visits (ISMCTS) or samples (PIMC) and mean score of each root input, by `inputKey`. */
  stats: Map<string, { input: PlayerInput; visits: number; mean: number }>;
  iterations: number;
  rng: RngState;
}

/** An input without who sends it or when: the same move across worlds. */
export function inputKey(input: PlayerInput): string {
  switch (input.type) {
    case "DECLARE":
      return `D:${input.action}:${input.targetId ?? ""}`;
    case "BLOCK":
      return `B:${input.role}`;
    case "CHOOSE_LOSS":
      return `L:${input.cardIndex}`;
    case "CHOOSE_EXCHANGE":
      return `E:${input.keep.join(",")}`;
    case "CHOOSE_REPLACEMENT":
      return `R:${input.deckIndex}`;
    default:
      return input.type;
  }
}

/** UCT exploration constant (scores are win chances in [0, 1]). */
const EXPLORATION = 0.7;

interface Node {
  /** The player who made the move leading here (its scores are from their point of view). */
  mover: PlayerId | null;
  input: PlayerInput | null;
  visits: number;
  /** Times this node's move was available when its parent was visited (ISMCTS). */
  available: number;
  score: number;
  children: Map<string, Node>;
}

const node = (mover: PlayerId | null, input: PlayerInput | null): Node => ({
  mover,
  input,
  visits: 0,
  available: 0,
  score: 0,
  children: new Map(),
});

/**
 * ISMCTS (Cowling, Powley & Whitehouse 2012) over this bot's own decisions: one tree for every
 * world. Each iteration guesses a world and walks down this bot's moves legal in it (UCT with
 * availability counts), while other players move by the quick policy in between; it adds one node,
 * plays on with the quick policy and backs up the score.
 */
export function ismcts(
  view: PlayerView,
  memory: BotMemory,
  legal: PlayerInput[],
  rng: RngState,
  options: SearchOptions,
): SearchResult {
  const me = view.viewerId as PlayerId;
  const root = node(null, null);
  const started = options.now();
  let iterations = 0;

  while (iterations < options.maxIterations && options.now() - started < options.timeMs) {
    let guess: ReturnType<typeof guessWorld>[0];
    [guess, rng] = guessWorld(view, memory, rng);
    let state = determinize(view, guess, `w${iterations}`);
    let current = root;
    const path: Node[] = [];

    for (let depth = 0; state.phase.kind !== "GAME_OVER"; depth++) {
      // At the root it is this bot's decision; deeper, whoever the engine waits for.
      const decider = depth === 0 ? { id: me, legal } : nextDecider(state);
      if (!decider) break;
      if (decider.id !== me) {
        // Other players move by the quick policy, from their own cards only. Searching their
        // moves in this one tree would let them "see" this bot's real cards (the strategy fusion
        // of single-observer ISMCTS), and the bot would bluff too little.
        let input: PlayerInput;
        [input, rng] = quickInput(state, decider.id, decider.legal, rng);
        state = apply(state, input);
        if (state.turnNumber >= view.turnNumber + options.rolloutTurns) break;
        continue;
      }
      const moves = decider.legal.map((input) => ({ input, key: inputKey(input) }));
      const untried = moves.filter((m) => !current.children.has(m.key));
      let chosen: Node;
      if (untried.length > 0) {
        let roll: number;
        [roll, rng] = nextRoll(rng);
        const move = untried[Math.floor(roll * untried.length)] as (typeof untried)[number];
        chosen = node(decider.id, move.input);
        current.children.set(move.key, chosen);
        state = apply(state, move.input);
        path.push(chosen);
        break;
      }
      let best: { child: Node; input: PlayerInput } | null = null;
      let bestValue = -Infinity;
      for (const move of moves) {
        const child = current.children.get(move.key) as Node;
        child.available += 1;
        const value =
          child.score / child.visits +
          EXPLORATION * Math.sqrt(Math.log(child.available) / child.visits);
        if (value > bestValue) {
          bestValue = value;
          best = { child, input: move.input };
        }
      }
      if (!best) break;
      state = apply(state, best.input);
      path.push(best.child);
      current = best.child;
    }

    [state, rng] = playout(state, options.rolloutTurns, rng);
    const scores = evaluate(state, view.turnNumber);
    for (const n of path) {
      n.visits += 1;
      n.score += scores.get(n.mover as PlayerId) ?? 0;
    }
    iterations += 1;
  }

  const stats: SearchResult["stats"] = new Map();
  for (const [key, child] of root.children) {
    stats.set(key, {
      input: child.input as PlayerInput,
      visits: child.visits,
      mean: child.visits > 0 ? child.score / child.visits : 0,
    });
  }
  return { stats, iterations, rng };
}

/**
 * Perfect Information Monte Carlo, the baseline (§7.1): every root input is tried in the same
 * guessed worlds (common random numbers) and scored after the quick policy plays on.
 */
export function pimc(
  view: PlayerView,
  memory: BotMemory,
  legal: PlayerInput[],
  rng: RngState,
  options: SearchOptions,
): SearchResult {
  const me = view.viewerId as PlayerId;
  const totals = legal.map((input) => ({ input, visits: 0, score: 0 }));
  const started = options.now();
  let iterations = 0;

  while (iterations < options.maxIterations && options.now() - started < options.timeMs) {
    let guess: ReturnType<typeof guessWorld>[0];
    [guess, rng] = guessWorld(view, memory, rng);
    const world = determinize(view, guess, `w${iterations}`);
    const playoutStart = rng;
    for (const t of totals) {
      // Same world and same dice for every option, so differences come from the option.
      let [state, r] = [apply(world, t.input), playoutStart];
      [state, r] = playout(state, options.rolloutTurns, r);
      t.visits += 1;
      t.score += evaluate(state, view.turnNumber).get(me) ?? 0;
      iterations += 1;
    }
    [, rng] = nextRoll(rng);
  }

  const stats: SearchResult["stats"] = new Map();
  for (const t of totals) {
    stats.set(inputKey(t.input), {
      input: t.input,
      visits: t.visits,
      mean: t.visits > 0 ? t.score / t.visits : 0,
    });
  }
  return { stats, iterations, rng };
}
