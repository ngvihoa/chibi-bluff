// Rebuilds a full game state from one seat's view plus a guess for what that seat cannot see
// (docs/bot-ai.md §7.2). The hard bot thinks ahead in such imagined "worlds": it never reads the
// real state, only its own PlayerView and its guesses, so this gives it no hidden information.

import { createRng } from "./rng";
import { ROLES, type Role } from "./rules";
import {
  type Card,
  DEFAULT_TIMEOUTS,
  type GameState,
  type Phase,
  type PlayerId,
  type PlayerView,
} from "./types";

/** The hidden part of a world, as guessed by the viewer. */
export interface WorldGuess {
  /** Face-down roles of every other player, one per face-down card, in card order. */
  hands: Record<PlayerId, Role[]>;
  /** The court deck, top first; exactly `view.deckSize` cards. */
  deck: Role[];
  /** Another player's exchange in progress: the two cards they drew. */
  exchangeDrawn?: Role[];
}

/**
 * A state consistent with `view` in which the hidden cards are `guess`. Throws when the guess does
 * not fit the view (wrong card counts, or more than three copies of a character).
 */
export function determinize(view: PlayerView, guess: WorldGuess, seed: string): GameState {
  const players = view.players.map((p) => {
    const guessed = [...(guess.hands[p.id] ?? [])];
    const cards: Card[] = p.cards.map((card) => {
      if (card.revealed) return { role: card.role, revealed: true };
      if (card.role) return { role: card.role, revealed: false };
      const role = guessed.shift();
      if (!role) throw new Error(`No guess for a face-down card of ${p.id}`);
      return { role, revealed: false };
    });
    if (guessed.length > 0) throw new Error(`Too many guessed cards for ${p.id}`);
    return { id: p.id, coins: p.coins, cards };
  });
  if (guess.deck.length !== view.deckSize) throw new Error("Guessed deck has the wrong size");

  let phase: Phase;
  if (view.phase.kind === "AWAIT_EXCHANGE") {
    const { playerId } = view.phase;
    let options = view.phase.options;
    if (!options) {
      const exchanger = players.find((p) => p.id === playerId);
      const held = exchanger?.cards.filter((c) => !c.revealed).map((c) => c.role) ?? [];
      if (guess.exchangeDrawn?.length !== 2) throw new Error("Missing the exchange's drawn cards");
      options = [...held, ...guess.exchangeDrawn];
    }
    phase = { ...view.phase, options: [...options] };
  } else {
    phase = structuredClone(view.phase);
  }

  const state: GameState = {
    config: { playerIds: view.players.map((p) => p.id), ...DEFAULT_TIMEOUTS },
    players,
    deck: [...guess.deck],
    rng: createRng(seed),
    turnNumber: view.turnNumber,
    turn: structuredClone(view.turn),
    phase,
    phaseId: view.phaseId,
    pending: structuredClone(view.pending),
  };
  checkCounts(state);
  return state;
}

/** Every character exists exactly three times across hands, deck and an exchange in progress. */
function checkCounts(state: GameState) {
  const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const p of state.players) for (const c of p.cards) counts[c.role] += 1;
  for (const role of state.deck) counts[role] += 1;
  if (state.phase.kind === "AWAIT_EXCHANGE") {
    // The options repeat the exchanger's face-down cards; only the drawn ones are extra.
    for (const role of state.phase.options.slice(state.phase.keepCount)) counts[role] += 1;
  }
  for (const role of ROLES) {
    if (counts[role] !== 3) throw new Error(`World has ${counts[role]} × ${role}, not 3`);
  }
}
