// The state machine (docs/game-rules.md §9, docs/architecture.md §3.3).
//
// applyInput clones the state, mutates the clone through small step functions and returns it with
// the events produced. Response windows keep the "nobody objects" continuation in `pending`;
// challenges and blocks rewrite that queue, and runPending drains it until a player must act.

import { createRng, nextInt, shuffle } from "./rng";
import { ACTION_RULES, ACTION_TYPES, type ActionType, createDeck, type Role, RULES } from "./rules";
import {
  alivePlayers,
  canBlockAction,
  canChallengeAction,
  currentAction,
  findPlayer,
  getPlayer,
  hasHiddenRole,
  hiddenIndexes,
  hiddenRoles,
  isAlive,
  nextAliveAfter,
  pendingResponders,
} from "./state";
import type {
  ApplyResult,
  CoinReason,
  EngineError,
  GameConfig,
  GameEvent,
  GameState,
  Input,
  LossReason,
  Phase,
  PlayerId,
  PlayerInput,
  PlayerState,
} from "./types";

interface Ctx {
  state: GameState;
  events: GameEvent[];
  now: number;
}

type StepResult = EngineError | null;

// ---------- Public API ----------

export function createGame(
  config: GameConfig,
  seed: string,
  now: number,
): { state: GameState; events: GameEvent[] } {
  validateConfig(config);
  let [deck, rng] = shuffle(createDeck(), createRng(seed));
  const players: PlayerState[] = config.playerIds.map((id) => ({
    id,
    coins: RULES.STARTING_COINS,
    cards: [],
  }));
  // R-SU-1: deal two cards each, one at a time around the table.
  for (let round = 0; round < RULES.STARTING_CARDS; round++) {
    for (const player of players) {
      const role = deck.shift();
      if (!role) throw new Error("Deck ran out while dealing");
      player.cards.push({ role, revealed: false });
    }
  }
  // R-SU-3: random first player.
  const [firstIndex, rngAfterDeal] = nextInt(rng, players.length);
  rng = rngAfterDeal;
  const first = players[firstIndex] as PlayerState;
  // R-SU-4: in a two-player game the first player starts with 1 coin.
  if (players.length === 2) first.coins = RULES.TWO_PLAYER_FIRST_PLAYER_COINS;

  const state: GameState = {
    config: structuredClone(config),
    players,
    deck,
    rng,
    turnNumber: 1,
    turn: { actorId: first.id, action: null, block: null },
    phase: { kind: "AWAIT_ACTION", deadline: actionDeadline(config, now) },
    phaseId: 1,
    pending: [],
  };
  return {
    state,
    events: [
      { type: "GAME_STARTED", firstPlayerId: first.id },
      { type: "TURN_STARTED", playerId: first.id, turnNumber: 1 },
    ],
  };
}

/**
 * Applies one input. Pure: the given state is never modified.
 * `now` is the host's clock (ms); the engine never reads a clock itself.
 */
export function applyInput(state: GameState, input: Input, now: number): ApplyResult {
  if (state.phase.kind === "GAME_OVER") return { ok: false, error: "GAME_OVER" };
  const ctx: Ctx = { state: structuredClone(state), events: [], now };
  const error = input.type === "TIMEOUT" ? onTimeout(ctx) : onPlayerInput(ctx, input);
  return error ? { ok: false, error } : { ok: true, state: ctx.state, events: ctx.events };
}

// ---------- Dispatch ----------

function onPlayerInput(ctx: Ctx, input: PlayerInput): StepResult {
  const { state } = ctx;
  const player = findPlayer(state, input.playerId);
  if (!player) return "UNKNOWN_PLAYER";
  if (!isAlive(player)) return "PLAYER_ELIMINATED";
  if (input.phaseId !== undefined && input.phaseId !== state.phaseId) return "STALE_INPUT";

  switch (state.phase.kind) {
    case "AWAIT_ACTION":
      if (input.type !== "DECLARE") return "WRONG_PHASE";
      return declare(ctx, input.playerId, input.action, input.targetId);
    case "AWAIT_ACTION_RESPONSE":
      if (input.type === "CHALLENGE") return challengeAction(ctx, input.playerId);
      if (input.type === "BLOCK") return block(ctx, input.playerId, input.role);
      if (input.type === "PASS") return pass(ctx, input.playerId);
      return "WRONG_PHASE";
    case "AWAIT_BLOCK_RESPONSE":
      // R-BL-3: a block cannot itself be blocked.
      if (input.type === "CHALLENGE") return challengeBlock(ctx, input.playerId);
      if (input.type === "PASS") return pass(ctx, input.playerId);
      return "WRONG_PHASE";
    case "AWAIT_INFLUENCE_LOSS":
      if (input.type !== "CHOOSE_LOSS") return "WRONG_PHASE";
      return chooseLoss(ctx, input.playerId, input.cardIndex);
    case "AWAIT_EXCHANGE":
      if (input.type !== "CHOOSE_EXCHANGE") return "WRONG_PHASE";
      return chooseExchange(ctx, input.playerId, input.keep);
    case "GAME_OVER":
      return "GAME_OVER";
  }
}

function onTimeout(ctx: Ctx): StepResult {
  const { state, now } = ctx;
  const { phase } = state;
  if (phase.deadline === null || now < phase.deadline) return "DEADLINE_NOT_REACHED";

  switch (phase.kind) {
    case "AWAIT_ACTION": {
      // R-DG-7: idle player takes Income, or is forced to Coup the next player (R-AC-8).
      const actor = getPlayer(state, state.turn.actorId);
      if (actor.coins >= RULES.MUST_COUP_AT) {
        return declare(ctx, actor.id, "coup", nextAliveAfter(state, actor.id));
      }
      return declare(ctx, actor.id, "income", undefined);
    }
    case "AWAIT_ACTION_RESPONSE":
    case "AWAIT_BLOCK_RESPONSE":
      // R-DG-1: silence counts as passing.
      for (const id of pendingResponders(state)) {
        phase.passed.push(id);
        ctx.events.push({ type: "PASSED", playerId: id });
      }
      return closeWindowIfDone(ctx);
    case "AWAIT_INFLUENCE_LOSS": {
      // R-DG-3: random card on timeout.
      const options = hiddenIndexes(getPlayer(state, phase.playerId));
      let pick: number;
      [pick, state.rng] = nextInt(state.rng, options.length);
      return chooseLoss(ctx, phase.playerId, options[pick] as number);
    }
    case "AWAIT_EXCHANGE": {
      const indexes = phase.options.map((_, i) => i);
      let shuffled: number[];
      [shuffled, state.rng] = shuffle(indexes, state.rng);
      return chooseExchange(ctx, phase.playerId, shuffled.slice(0, phase.keepCount));
    }
  }
}

// ---------- Declaring an action ----------

function declare(
  ctx: Ctx,
  playerId: PlayerId,
  type: ActionType,
  requestedTarget: PlayerId | undefined,
): StepResult {
  const { state } = ctx;
  if (playerId !== state.turn.actorId) return "NOT_YOUR_TURN";
  if (!ACTION_TYPES.includes(type)) return "INVALID_ACTION";
  const actor = getPlayer(state, playerId);
  const rule = ACTION_RULES[type];

  if (actor.coins >= RULES.MUST_COUP_AT && type !== "coup") return "MUST_COUP"; // R-AC-8
  if (actor.coins < rule.cost) return "NOT_ENOUGH_COINS"; // R-AC-9

  let targetId: PlayerId | null = null;
  if (rule.targeted) {
    // R-AC-10
    const target = requestedTarget === undefined ? undefined : findPlayer(state, requestedTarget);
    if (!target || target.id === actor.id || !isAlive(target)) return "INVALID_TARGET";
    targetId = target.id;
  } else if (requestedTarget !== undefined) {
    return "INVALID_TARGET";
  }

  const action = { type, actorId: actor.id, targetId };
  state.turn.action = action;
  ctx.events.push({ type: "ACTION_DECLARED", action });
  // R-AC-11: costs are paid on declaration.
  if (rule.cost > 0) {
    changeCoins(ctx, actor, -rule.cost, type === "coup" ? "COUP_COST" : "ASSASSINATE_COST");
  }

  state.pending = [{ kind: "EXECUTE_ACTION" }, { kind: "END_TURN" }];
  if (rule.claim !== null || rule.blockers.length > 0) {
    if (openActionWindow(ctx, true)) return null;
  }
  runPending(ctx);
  return null;
}

/** Opens the challenge/block window. Returns false (and opens nothing) if nobody may respond. */
function openActionWindow(ctx: Ctx, allowChallenge: boolean): boolean {
  const deadline = ctx.now + ctx.state.config.responseTimeoutMs;
  setPhase(ctx, { kind: "AWAIT_ACTION_RESPONSE", allowChallenge, passed: [], deadline });
  return pendingResponders(ctx.state).length > 0;
}

// ---------- Responses ----------

function pass(ctx: Ctx, playerId: PlayerId): StepResult {
  const { phase } = ctx.state;
  if (phase.kind !== "AWAIT_ACTION_RESPONSE" && phase.kind !== "AWAIT_BLOCK_RESPONSE") {
    return "WRONG_PHASE";
  }
  if (phase.passed.includes(playerId)) return "ALREADY_RESPONDED";
  if (!pendingResponders(ctx.state).includes(playerId)) return "NOT_ELIGIBLE";
  phase.passed.push(playerId);
  ctx.events.push({ type: "PASSED", playerId });
  return closeWindowIfDone(ctx);
}

/** R-DG-2: the window ends as soon as everyone eligible has passed. */
function closeWindowIfDone(ctx: Ctx): StepResult {
  const { state } = ctx;
  if (pendingResponders(state).length > 0) return null;
  if (state.phase.kind === "AWAIT_BLOCK_RESPONSE") {
    // R-BL-4: an unchallenged block stands.
    state.pending = [{ kind: "ACTION_BLOCKED" }, { kind: "END_TURN" }];
  }
  runPending(ctx);
  return null;
}

function challengeAction(ctx: Ctx, challengerId: PlayerId): StepResult {
  const { state } = ctx;
  if (state.phase.kind === "AWAIT_ACTION_RESPONSE" && state.phase.passed.includes(challengerId)) {
    return "ALREADY_RESPONDED";
  }
  if (!canChallengeAction(state, challengerId)) return "CANNOT_CHALLENGE";
  const { action, rule } = currentAction(state);
  const role = rule.claim;
  if (role === null) return "CANNOT_CHALLENGE";
  const actor = getPlayer(state, action.actorId);
  const truthful = hasHiddenRole(actor, role);

  ctx.events.push({ type: "CHALLENGED", challengerId, claimantId: actor.id, role });
  ctx.events.push({
    type: "CHALLENGE_RESOLVED",
    challengerId,
    claimantId: actor.id,
    role,
    truthful,
  });

  if (truthful) {
    // R-CH-4 / R-CH-5: challenger loses first, then the actor swaps the proven card.
    // A blockable action may still be blocked afterwards.
    state.pending = [
      { kind: "LOSE_INFLUENCE", playerId: challengerId, reason: "FAILED_CHALLENGE" },
      { kind: "REPLACE_CARD", playerId: actor.id, role },
      ...(rule.blockers.length > 0 ? [{ kind: "OPEN_BLOCK_WINDOW" } as const] : []),
      ...state.pending,
    ];
  } else {
    // R-CH-3: bluff caught — action fails and its cost is refunded.
    if (rule.cost > 0) changeCoins(ctx, actor, rule.cost, "REFUND");
    ctx.events.push({ type: "ACTION_FAILED", action, reason: "BLUFF_CAUGHT" });
    state.pending = [
      { kind: "LOSE_INFLUENCE", playerId: actor.id, reason: "BLUFF_CAUGHT" },
      { kind: "END_TURN" },
    ];
  }
  runPending(ctx);
  return null;
}

function block(ctx: Ctx, blockerId: PlayerId, role: Role): StepResult {
  const { state } = ctx;
  if (state.phase.kind === "AWAIT_ACTION_RESPONSE" && state.phase.passed.includes(blockerId)) {
    return "ALREADY_RESPONDED";
  }
  if (!canBlockAction(state, blockerId, role)) return "CANNOT_BLOCK";
  state.turn.block = { blockerId, role };
  ctx.events.push({ type: "BLOCK_DECLARED", block: state.turn.block });
  const deadline = ctx.now + state.config.responseTimeoutMs;
  setPhase(ctx, { kind: "AWAIT_BLOCK_RESPONSE", passed: [], deadline });
  return null;
}

function challengeBlock(ctx: Ctx, challengerId: PlayerId): StepResult {
  const { state } = ctx;
  const blk = state.turn.block;
  if (!blk) return "WRONG_PHASE";
  if (state.phase.kind === "AWAIT_BLOCK_RESPONSE" && state.phase.passed.includes(challengerId)) {
    return "ALREADY_RESPONDED";
  }
  if (challengerId === blk.blockerId) return "CANNOT_CHALLENGE";
  const blocker = getPlayer(state, blk.blockerId);
  const truthful = hasHiddenRole(blocker, blk.role);

  ctx.events.push({ type: "CHALLENGED", challengerId, claimantId: blocker.id, role: blk.role });
  ctx.events.push({
    type: "CHALLENGE_RESOLVED",
    challengerId,
    claimantId: blocker.id,
    role: blk.role,
    truthful,
  });

  if (truthful) {
    // R-CH-4: the block stands.
    state.pending = [
      { kind: "LOSE_INFLUENCE", playerId: challengerId, reason: "FAILED_CHALLENGE" },
      { kind: "REPLACE_CARD", playerId: blocker.id, role: blk.role },
      { kind: "ACTION_BLOCKED" },
      { kind: "END_TURN" },
    ];
  } else {
    // R-BL-5: blocker loses a card and the original action goes ahead.
    state.pending = [
      { kind: "LOSE_INFLUENCE", playerId: blocker.id, reason: "BLUFF_CAUGHT" },
      ...state.pending,
    ];
  }
  runPending(ctx);
  return null;
}

// ---------- Choices ----------

function chooseLoss(ctx: Ctx, playerId: PlayerId, cardIndex: number): StepResult {
  const { state } = ctx;
  const { phase } = state;
  if (phase.kind !== "AWAIT_INFLUENCE_LOSS") return "WRONG_PHASE";
  if (playerId !== phase.playerId) return "NOT_YOUR_TURN";
  const player = getPlayer(state, playerId);
  const card = Number.isInteger(cardIndex) ? player.cards[cardIndex] : undefined;
  if (!card || card.revealed) return "INVALID_CARD";
  loseCard(ctx, player, cardIndex, phase.reason); // R-IN-1
  runPending(ctx);
  return null;
}

function chooseExchange(ctx: Ctx, playerId: PlayerId, keep: number[]): StepResult {
  const { state } = ctx;
  const { phase } = state;
  if (phase.kind !== "AWAIT_EXCHANGE") return "WRONG_PHASE";
  if (playerId !== phase.playerId) return "NOT_YOUR_TURN";
  const valid =
    Array.isArray(keep) &&
    keep.length === phase.keepCount &&
    new Set(keep).size === keep.length &&
    keep.every((i) => Number.isInteger(i) && i >= 0 && i < phase.options.length);
  if (!valid) return "INVALID_EXCHANGE";

  // R-AC-7: keep the chosen cards, return the rest and shuffle.
  const kept = keep.map((i) => phase.options[i]);
  const returned = phase.options.filter((_, i) => !keep.includes(i));
  const player = getPlayer(state, playerId);
  let k = 0;
  for (const card of player.cards) {
    if (!card.revealed) card.role = kept[k++] ?? card.role;
  }
  [state.deck, state.rng] = shuffle([...state.deck, ...returned], state.rng);
  ctx.events.push({ type: "EXCHANGE_COMPLETED", playerId });
  runPending(ctx);
  return null;
}

// ---------- Pending queue ----------

function runPending(ctx: Ctx): void {
  const { state } = ctx;
  while (state.pending.length > 0) {
    if (state.phase.kind === "GAME_OVER") {
      state.pending = [];
      return;
    }
    const step = state.pending.shift();
    if (!step) return;
    switch (step.kind) {
      case "LOSE_INFLUENCE": {
        const player = getPlayer(state, step.playerId);
        if (!isAlive(player)) break;
        const hidden = hiddenIndexes(player);
        if (hidden.length === 1) {
          // Only one card left: nothing to choose.
          loseCard(ctx, player, hidden[0] as number, step.reason);
          break;
        }
        const deadline = ctx.now + state.config.choiceTimeoutMs;
        setPhase(ctx, {
          kind: "AWAIT_INFLUENCE_LOSS",
          playerId: player.id,
          reason: step.reason,
          deadline,
        });
        return;
      }
      case "REPLACE_CARD":
        replaceCard(ctx, step.playerId, step.role);
        break;
      case "OPEN_BLOCK_WINDOW":
        if (openActionWindow(ctx, false)) return;
        break;
      case "EXECUTE_ACTION":
        if (executeAction(ctx)) return;
        break;
      case "ACTION_BLOCKED": {
        const { action } = currentAction(state);
        const blk = state.turn.block;
        if (blk) ctx.events.push({ type: "ACTION_BLOCKED", action, block: blk });
        break;
      }
      case "END_TURN":
        endTurn(ctx);
        break;
    }
  }
}

/** Applies the action's effect. Returns true if it now waits for a player (Exchange). */
function executeAction(ctx: Ctx): boolean {
  const { state } = ctx;
  const { action } = currentAction(state);
  const actor = getPlayer(state, action.actorId);
  const target = action.targetId === null ? null : getPlayer(state, action.targetId);

  // R-IN-5: target already out — nothing happens, costs stay paid.
  if (target && !isAlive(target)) {
    ctx.events.push({ type: "ACTION_FAILED", action, reason: "TARGET_ELIMINATED" });
    return false;
  }
  ctx.events.push({ type: "ACTION_RESOLVED", action });

  switch (action.type) {
    case "income":
      changeCoins(ctx, actor, RULES.INCOME_GAIN, "INCOME");
      return false;
    case "foreignAid":
      changeCoins(ctx, actor, RULES.FOREIGN_AID_GAIN, "FOREIGN_AID");
      return false;
    case "tax":
      changeCoins(ctx, actor, RULES.TAX_GAIN, "TAX");
      return false;
    case "steal": {
      if (!target) return false;
      const amount = Math.min(RULES.STEAL_MAX, target.coins);
      if (amount > 0) {
        changeCoins(ctx, target, -amount, "STEAL");
        changeCoins(ctx, actor, amount, "STEAL");
      }
      return false;
    }
    case "coup":
    case "assassinate":
      if (target) {
        const reason: LossReason = action.type === "coup" ? "COUP" : "ASSASSINATED";
        state.pending.unshift({ kind: "LOSE_INFLUENCE", playerId: target.id, reason });
      }
      return false;
    case "exchange": {
      const drawn = state.deck.splice(0, RULES.EXCHANGE_DRAW);
      const keepCount = hiddenRoles(actor).length;
      ctx.events.push({ type: "EXCHANGE_STARTED", playerId: actor.id, drawn });
      setPhase(ctx, {
        kind: "AWAIT_EXCHANGE",
        playerId: actor.id,
        options: [...hiddenRoles(actor), ...drawn],
        keepCount,
        deadline: ctx.now + state.config.choiceTimeoutMs,
      });
      return true;
    }
  }
}

function endTurn(ctx: Ctx): void {
  const { state } = ctx;
  const next = nextAliveAfter(state, state.turn.actorId);
  state.turnNumber += 1;
  state.turn = { actorId: next, action: null, block: null };
  setPhase(ctx, { kind: "AWAIT_ACTION", deadline: actionDeadline(state.config, ctx.now) });
  ctx.events.push({ type: "TURN_STARTED", playerId: next, turnNumber: state.turnNumber });
}

// ---------- Primitives ----------

function setPhase(ctx: Ctx, phase: Phase): void {
  ctx.state.phase = phase;
  ctx.state.phaseId += 1;
}

function changeCoins(ctx: Ctx, player: PlayerState, delta: number, reason: CoinReason): void {
  player.coins += delta;
  ctx.events.push({ type: "COINS_CHANGED", playerId: player.id, delta, reason });
}

function loseCard(ctx: Ctx, player: PlayerState, index: number, reason: LossReason): void {
  const card = player.cards[index];
  if (!card || card.revealed) return;
  card.revealed = true; // R-IN-2
  ctx.events.push({ type: "INFLUENCE_LOST", playerId: player.id, role: card.role, reason });
  if (isAlive(player)) return;

  // R-IN-3: eliminated players return their coins.
  if (player.coins > 0) changeCoins(ctx, player, -player.coins, "ELIMINATED");
  ctx.events.push({ type: "PLAYER_ELIMINATED", playerId: player.id });

  const remaining = alivePlayers(ctx.state);
  if (remaining.length === 1) {
    // R-EN-1
    const winnerId = (remaining[0] as PlayerState).id;
    setPhase(ctx, { kind: "GAME_OVER", winnerId, deadline: null });
    ctx.state.pending = [];
    ctx.events.push({ type: "GAME_OVER", winnerId });
  }
}

/** R-CH-4: shuffle the proven card into the deck and draw a replacement. */
function replaceCard(ctx: Ctx, playerId: PlayerId, role: Role): void {
  const { state } = ctx;
  const player = getPlayer(state, playerId);
  const card = player.cards.find((c) => !c.revealed && c.role === role);
  if (!card) return;
  [state.deck, state.rng] = shuffle([...state.deck, role], state.rng);
  const newRole = state.deck.shift();
  if (!newRole) throw new Error("Deck empty while replacing a card");
  card.role = newRole;
  ctx.events.push({ type: "CARD_REPLACED", playerId, newRole });
}

function actionDeadline(config: GameConfig, now: number): number | null {
  return config.actionTimeoutMs === null ? null : now + config.actionTimeoutMs;
}

function validateConfig(config: GameConfig): void {
  const ids = config.playerIds;
  if (ids.length < RULES.MIN_PLAYERS || ids.length > RULES.MAX_PLAYERS) {
    throw new Error(
      `Expected ${RULES.MIN_PLAYERS}–${RULES.MAX_PLAYERS} players, got ${ids.length}`,
    );
  }
  if (new Set(ids).size !== ids.length || ids.some((id) => typeof id !== "string" || id === "")) {
    throw new Error("Player ids must be unique, non-empty strings");
  }
  const timeouts = [config.responseTimeoutMs, config.choiceTimeoutMs, config.actionTimeoutMs];
  if (timeouts.some((t) => t !== null && !(Number.isFinite(t) && t > 0))) {
    throw new Error("Timeouts must be positive numbers");
  }
}
