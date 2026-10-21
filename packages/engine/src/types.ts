// Core data types of the engine. Flow and phase names follow docs/game-rules.md §9 and
// docs/architecture.md §3. Everything here is plain, JSON-serialisable data.

import type { RngState } from "./rng";
import type { ActionType, Role } from "./rules";

export type PlayerId = string;

// ---------- Configuration ----------

export interface GameConfig {
  /** Seating order (clockwise). 2–6 unique ids. */
  playerIds: readonly PlayerId[];
  /** Response window for challenges and blocks (R-DG-1). */
  responseTimeoutMs: number;
  /** Time to choose a card to lose or keep (R-DG-3). */
  choiceTimeoutMs: number;
}

export const DEFAULT_TIMEOUTS = {
  responseTimeoutMs: 8_000,
  choiceTimeoutMs: 15_000,
} as const satisfies Pick<GameConfig, "responseTimeoutMs" | "choiceTimeoutMs">;

// ---------- State ----------

export interface Card {
  role: Role;
  /** Face up = influence lost (R-IN-2). */
  revealed: boolean;
}

export interface PlayerState {
  id: PlayerId;
  coins: number;
  cards: Card[];
}

export interface DeclaredAction {
  type: ActionType;
  actorId: PlayerId;
  targetId: PlayerId | null;
}

export interface DeclaredBlock {
  blockerId: PlayerId;
  role: Role;
}

export interface TurnState {
  actorId: PlayerId;
  action: DeclaredAction | null;
  block: DeclaredBlock | null;
}

export type LossReason =
  /** The claimant was challenged and could not prove the character (R-CH-3). */
  | "BLUFF_CAUGHT"
  /** The challenger was wrong (R-CH-4). */
  | "FAILED_CHALLENGE"
  | "COUP"
  | "ASSASSINATED";

/** Work queued for the current turn; processed in order until a step needs player input. */
export type PendingStep =
  | { kind: "LOSE_INFLUENCE"; playerId: PlayerId; reason: LossReason }
  /** Winner of a challenge shuffles the proven card back and draws a new one (R-CH-4). */
  | { kind: "REPLACE_CARD"; playerId: PlayerId; role: Role }
  | { kind: "OPEN_BLOCK_WINDOW" }
  | { kind: "EXECUTE_ACTION" }
  | { kind: "END_TURN" };

export type Phase =
  | { kind: "AWAIT_ACTION"; deadline: null }
  | { kind: "AWAIT_ACTION_RESPONSE"; passed: PlayerId[]; deadline: number }
  | { kind: "AWAIT_BLOCK_RESPONSE"; passed: PlayerId[]; deadline: number }
  | { kind: "AWAIT_INFLUENCE_LOSS"; playerId: PlayerId; reason: LossReason; deadline: number }
  | {
      kind: "AWAIT_EXCHANGE";
      playerId: PlayerId;
      /** Player's face-down roles followed by the drawn cards. */
      options: Role[];
      /** How many of `options` must be kept (= face-down cards before the exchange). */
      keepCount: number;
      deadline: number;
    }
  | { kind: "GAME_OVER"; winnerId: PlayerId; deadline: null };

export interface GameState {
  config: GameConfig;
  /** Seating order. Eliminated players stay in the array. */
  players: PlayerState[];
  /** Court deck; index 0 is the top. */
  deck: Role[];
  rng: RngState;
  turnNumber: number;
  turn: TurnState;
  phase: Phase;
  pending: PendingStep[];
}

// ---------- Inputs ----------

export type Input =
  | { type: "DECLARE"; playerId: PlayerId; action: ActionType; targetId?: PlayerId }
  | { type: "CHALLENGE"; playerId: PlayerId }
  | { type: "BLOCK"; playerId: PlayerId; role: Role }
  | { type: "PASS"; playerId: PlayerId }
  | { type: "CHOOSE_LOSS"; playerId: PlayerId; cardIndex: number }
  /** Indexes into `options` of the AWAIT_EXCHANGE phase. */
  | { type: "CHOOSE_EXCHANGE"; playerId: PlayerId; keep: number[] }
  /** Sent by the host when the current phase's deadline has passed. */
  | { type: "TIMEOUT" };

export type EngineError =
  | "GAME_OVER"
  | "UNKNOWN_PLAYER"
  | "PLAYER_ELIMINATED"
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "NOT_ENOUGH_COINS"
  | "MUST_COUP"
  | "INVALID_TARGET"
  | "CANNOT_CHALLENGE"
  | "CANNOT_BLOCK"
  | "ALREADY_RESPONDED"
  | "INVALID_CARD"
  | "INVALID_EXCHANGE"
  | "DEADLINE_NOT_REACHED";

// ---------- Events ----------

export type GameEvent =
  | { type: "GAME_STARTED"; firstPlayerId: PlayerId }
  | { type: "TURN_STARTED"; playerId: PlayerId; turnNumber: number }
  | { type: "ACTION_DECLARED"; action: DeclaredAction }
  | { type: "COINS_CHANGED"; playerId: PlayerId; delta: number; reason: CoinReason }
  | { type: "PASSED"; playerId: PlayerId }
  | { type: "CHALLENGED"; challengerId: PlayerId; claimantId: PlayerId; role: Role }
  | {
      type: "CHALLENGE_RESOLVED";
      challengerId: PlayerId;
      claimantId: PlayerId;
      role: Role;
      /** True if the claimant really had the character. */
      truthful: boolean;
    }
  /** `newRole` is private to `playerId`; see event redaction in the view layer. */
  | { type: "CARD_REPLACED"; playerId: PlayerId; newRole: Role | null }
  | { type: "BLOCK_DECLARED"; block: DeclaredBlock }
  | { type: "ACTION_BLOCKED"; action: DeclaredAction; block: DeclaredBlock }
  | { type: "ACTION_FAILED"; action: DeclaredAction; reason: "BLUFF_CAUGHT" | "TARGET_ELIMINATED" }
  | { type: "ACTION_RESOLVED"; action: DeclaredAction }
  | { type: "INFLUENCE_LOST"; playerId: PlayerId; role: Role; reason: LossReason }
  /** `drawn` is private to `playerId`. */
  | { type: "EXCHANGE_STARTED"; playerId: PlayerId; drawn: Role[] | null }
  | { type: "EXCHANGE_COMPLETED"; playerId: PlayerId }
  | { type: "PLAYER_ELIMINATED"; playerId: PlayerId }
  | { type: "GAME_OVER"; winnerId: PlayerId };

export type CoinReason =
  | "INCOME"
  | "FOREIGN_AID"
  | "TAX"
  | "STEAL"
  | "COUP_COST"
  | "ASSASSINATE_COST"
  | "REFUND"
  | "ELIMINATED";

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineError };

// ---------- View (what one seat is allowed to see, R-DG-6) ----------

export type VisibleCard =
  | { revealed: true; role: Role }
  /** `role` is null unless the viewer owns the card. */
  | { revealed: false; role: Role | null };

export interface PlayerViewPlayer {
  id: PlayerId;
  coins: number;
  cards: VisibleCard[];
  eliminated: boolean;
}

export type PhaseView =
  | Exclude<Phase, { kind: "AWAIT_EXCHANGE" }>
  | {
      kind: "AWAIT_EXCHANGE";
      playerId: PlayerId;
      /** Only present for the exchanging player. */
      options: Role[] | null;
      keepCount: number;
      deadline: number;
    };

export interface PlayerView {
  /** null = spectator. */
  viewerId: PlayerId | null;
  players: PlayerViewPlayer[];
  deckSize: number;
  turnNumber: number;
  turn: TurnState;
  phase: PhaseView;
}
