// Fast play for imagined worlds (docs/bot-ai.md §7.2): thousands of moves per decision, so a
// cut-down normal bot. Each player decides from their own face-down cards and public information
// only, never from other players' cards, even in a world the hard bot made up.

import {
  ACTION_RULES,
  applyInput,
  type GameState,
  getLegalInputs,
  nextRandom,
  type PlayerId,
  type PlayerInput,
  type PlayerState,
  type RngState,
  type Role,
  RULES,
} from "@chibi-bluff/engine";

const lives = (p: PlayerState) => p.cards.filter((c) => !c.revealed).length;
const held = (p: PlayerState) => p.cards.filter((c) => !c.revealed).map((c) => c.role);

/** How much a character is worth keeping (for losing and exchanging cards). */
const KEEP_VALUE: Record<Role, number> = {
  duke: 3,
  captain: 3,
  assassin: 2.6,
  contessa: 2.2,
  ambassador: 1.6,
};

/** Who decides next: the first seat with something to do, from the acting player round. */
export function nextDecider(state: GameState): { id: PlayerId; legal: PlayerInput[] } | null {
  const ids = state.config.playerIds;
  const start = Math.max(0, ids.indexOf(state.turn.actorId));
  for (let k = 0; k < ids.length; k++) {
    const id = ids[(start + k) % ids.length] as PlayerId;
    const legal = getLegalInputs(state, id);
    if (legal.length > 0) return { id, legal };
  }
  return null;
}

export function apply(state: GameState, input: PlayerInput): GameState {
  const result = applyInput(state, input, 0);
  if (!result.ok) throw new Error(`Playout input refused: ${result.error}`);
  return result.state;
}

/**
 * Plays on until the game ends or `turns` more turns have started, with every player using the
 * quick policy. Returns the final state.
 */
export function playout(state: GameState, turns: number, rng: RngState): [GameState, RngState] {
  const stopAt = state.turnNumber + turns;
  let s = state;
  for (let step = 0; step < 400; step++) {
    if (s.phase.kind === "GAME_OVER" || s.turnNumber >= stopAt) break;
    const next = nextDecider(s);
    if (!next) break;
    let input: PlayerInput;
    [input, rng] = quickInput(s, next.id, next.legal, rng);
    s = apply(s, input);
  }
  return [s, rng];
}

/** A win is worth a little less for every turn it takes: better to finish the game now. */
const WIN_DISCOUNT_PER_TURN = 0.03;
const MIN_WIN_SCORE = 0.75;

/**
 * Each player's chance of winning from here, as a guess (§7.2): a win counts 1, less 3% for each
 * turn since `startTurn` (so the search prefers finishing now to finishing later); an unfinished
 * game shares the chances by cards left and coins towards a coup.
 */
export function evaluate(state: GameState, startTurn: number): Map<PlayerId, number> {
  const scores = new Map<PlayerId, number>();
  if (state.phase.kind === "GAME_OVER") {
    const turns = Math.max(0, state.turnNumber - startTurn);
    const win = Math.max(MIN_WIN_SCORE, 1 - WIN_DISCOUNT_PER_TURN * turns);
    for (const p of state.players) scores.set(p.id, p.id === state.phase.winnerId ? win : 0);
    return scores;
  }
  let total = 0;
  for (const p of state.players) {
    const l = lives(p);
    const strength =
      l === 0
        ? 0
        : l ** 1.5 + 0.08 * Math.min(p.coins, 10) + (p.coins >= ACTION_RULES.coup.cost ? 0.35 : 0);
    scores.set(p.id, strength);
    total += strength;
  }
  for (const [id, v] of scores) scores.set(id, total > 0 ? v / total : 0);
  return scores;
}

/** The quick policy: one sensible move for `id`, from what `id` can see. */
export function quickInput(
  state: GameState,
  id: PlayerId,
  legal: PlayerInput[],
  rng: RngState,
): [PlayerInput, RngState] {
  const me = state.players.find((p) => p.id === id) as PlayerState;
  const mine = held(me);
  let roll: number;
  [roll, rng] = nextRandom(rng);
  const find = (pred: (i: PlayerInput) => boolean) => legal.find(pred);
  const pass = find((i) => i.type === "PASS");

  switch (state.phase.kind) {
    case "AWAIT_ACTION": {
      const opponents = state.players.filter((p) => p.id !== id && lives(p) > 0);
      // The most dangerous opponent: most cards, then most coins.
      const threat = [...opponents].sort((a, b) => lives(b) - lives(a) || b.coins - a.coins)[0];
      const coup = legal.find(
        (i) => i.type === "DECLARE" && i.action === "coup" && i.targetId === threat?.id,
      );
      if (coup && (me.coins >= RULES.MUST_COUP_AT || roll < 0.9)) return [coup, rng];
      const weight = (i: PlayerInput): number => {
        if (i.type !== "DECLARE") return 0;
        const claim = ACTION_RULES[i.action].claim;
        const honest = !claim || mine.includes(claim);
        const target = state.players.find((p) => p.id === i.targetId);
        switch (i.action) {
          case "income":
            return 1;
          case "foreignAid":
            return 1.3;
          case "tax":
            return honest ? 6 : 0.5;
          case "steal":
            return (target?.coins ?? 0) < 2
              ? 0
              : (honest ? 4 : 0.35) * (target === threat ? 1.5 : 1);
          case "assassinate":
            return (honest ? 6 : 0.3) * (target === threat ? 1.6 : 1);
          case "exchange":
            return honest ? 1.4 : 0.3;
          case "coup":
            return target === threat ? 8 : 2;
        }
      };
      [roll, rng] = nextRandom(rng);
      return [weighted(legal, weight, roll), rng];
    }

    case "AWAIT_ACTION_RESPONSE":
    case "AWAIT_BLOCK_RESPONSE": {
      const claim =
        state.phase.kind === "AWAIT_BLOCK_RESPONSE"
          ? state.turn.block?.role
          : state.turn.action
            ? ACTION_RULES[state.turn.action.type].claim
            : null;
      const challenge = find((i) => i.type === "CHALLENGE");
      if (challenge && claim) {
        // Counting: all three copies accounted for means a sure bluff.
        const shown = state.players.reduce(
          (n, p) => n + p.cards.filter((c) => c.revealed && c.role === claim).length,
          0,
        );
        const sure = shown + mine.filter((r) => r === claim).length >= 3;
        const attacked = state.turn.action?.targetId === id;
        const desperate = attacked && state.turn.action?.type === "assassinate" && lives(me) === 1;
        const chance = desperate ? 0.35 : attacked ? 0.15 : 0.07;
        if (sure || roll < chance) return [challenge, rng];
      }
      const blocks = legal.filter(
        (i): i is Extract<PlayerInput, { type: "BLOCK" }> => i.type === "BLOCK",
      );
      const honestBlock = blocks.find((b) => mine.includes(b.role));
      if (honestBlock) return [honestBlock, rng];
      const lastCardVsKnife =
        state.turn.action?.type === "assassinate" &&
        state.turn.action.targetId === id &&
        lives(me) === 1;
      [roll, rng] = nextRandom(rng);
      if (blocks.length > 0 && (lastCardVsKnife ? roll < 0.5 : roll < 0.04)) {
        return [blocks[0] as PlayerInput, rng];
      }
      return [pass ?? (legal[0] as PlayerInput), rng];
    }

    case "AWAIT_INFLUENCE_LOSS": {
      const losses = legal.filter(
        (i): i is Extract<PlayerInput, { type: "CHOOSE_LOSS" }> => i.type === "CHOOSE_LOSS",
      );
      const worst = [...losses].sort(
        (a, b) =>
          KEEP_VALUE[(me.cards[a.cardIndex] as { role: Role }).role] -
          KEEP_VALUE[(me.cards[b.cardIndex] as { role: Role }).role],
      )[0];
      return [worst ?? (legal[0] as PlayerInput), rng];
    }

    case "AWAIT_EXCHANGE": {
      const { options } = state.phase;
      const choices = legal.filter(
        (i): i is Extract<PlayerInput, { type: "CHOOSE_EXCHANGE" }> => i.type === "CHOOSE_EXCHANGE",
      );
      const value = (keep: number[]) => {
        const roles = keep.map((k) => options[k] as Role);
        const distinct = new Set(roles).size;
        return roles.reduce((v, r) => v + KEEP_VALUE[r], 0) + distinct * 0.5;
      };
      const best = [...choices].sort((a, b) => value(b.keep) - value(a.keep))[0];
      return [best ?? (legal[0] as PlayerInput), rng];
    }

    default:
      // A replacement pick (every face-down card is equally unknown), or anything else.
      return [legal[Math.floor(roll * legal.length)] as PlayerInput, rng];
  }
}

function weighted(inputs: PlayerInput[], weight: (i: PlayerInput) => number, roll: number) {
  const weights = inputs.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return inputs[0] as PlayerInput;
  let left = roll * total;
  for (let i = 0; i < inputs.length; i++) {
    left -= weights[i] as number;
    if (left < 0) return inputs[i] as PlayerInput;
  }
  return inputs[inputs.length - 1] as PlayerInput;
}
