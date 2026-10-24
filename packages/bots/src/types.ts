// Bot contracts (docs/bot-ai.md §2). Bots only ever see a PlayerView — never the full GameState.

import type { PlayerId, PlayerInput, PlayerView, RngState, Role } from "@chibi-bluff/engine";

export type Difficulty = "random" | "easy" | "normal";

/** All traits are in [0, 1] (docs/bot-ai.md §8). */
export interface Personality {
  /** Willingness to claim a character it does not hold. */
  bluffRate: number;
  /** Tendency to challenge. */
  aggression: number;
  /** Willingness to gamble when down to one card. */
  riskTolerance: number;
  /** Tendency to retaliate against whoever attacked it. */
  vindictive: number;
  /** How often it sends stickers. */
  chatty: number;
}

/** What a bot remembers about one player, built only from public events. */
export interface PlayerRecord {
  /** Uncontested claims per character (actions and blocks). */
  claims: Record<Role, number>;
  /** Times the player could have blocked with a character but did not. */
  declined: Record<Role, number>;
  bluffsCaught: number;
  truthfulReveals: number;
  challengesMade: number;
}

export interface BotMemory {
  selfId: PlayerId;
  players: Record<PlayerId, PlayerRecord>;
  /** How much each player has attacked this bot. */
  grudges: Record<PlayerId, number>;
  /** Claims made this turn that have not been challenged (yet). */
  openClaims: { playerId: PlayerId; role: Role; kind: "action" | "block" }[];
}

export interface BotContext {
  view: PlayerView;
  /** Inputs the engine accepts from this seat right now (non-empty). */
  legal: PlayerInput[];
  memory: BotMemory;
  personality: Personality;
  rng: RngState;
}

export interface Decision {
  input: PlayerInput;
  rng: RngState;
  /** Suggested "thinking" delay before the host submits the input. */
  thinkMs: number;
}

export interface BotPolicy {
  readonly difficulty: Difficulty;
  decide(ctx: BotContext): Decision;
}
