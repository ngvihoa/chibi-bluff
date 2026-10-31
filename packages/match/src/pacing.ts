// Table pacing shared by bot games and online rooms (docs/game-rules.md R-DG-1/R-DG-3,
// docs/ui-design.md §5): how long each "moment" holds the bots, and the three pace settings.

import type { GameEvent, PlayerId } from "@chibi-bluff/engine";

/** How long the table needs to play an event's "moment" before bots move on (docs/ui-design.md §5). */
export const MOMENT_MS = {
  challenge: 1_700,
  eliminated: 1_600,
  /** A turn just ended: time to read what happened before the next player acts. */
  turn: 1_500,
  /** Someone blocked: let players see it before anyone challenges the block. */
  block: 700,
  /** A person drew a replacement card: the reveal and its flight into their hand (R-DG-8). */
  drew: 3_600,
} as const;

/**
 * Total pause for a batch of events. `humans` are the seats played by people: only their own
 * replacement draw plays a reveal (bots draw without one).
 */
export function momentPause(
  events: GameEvent[],
  humans: PlayerId | null | ReadonlySet<PlayerId> = null,
): number {
  const isHuman = (id: PlayerId) =>
    humans === null ? false : typeof humans === "string" ? humans === id : humans.has(id);
  let ms = 0;
  for (const e of events) {
    if (e.type === "CARD_REPLACED" && isHuman(e.playerId)) ms += MOMENT_MS.drew;
    if (e.type === "CHALLENGE_RESOLVED") ms += MOMENT_MS.challenge;
    if (e.type === "PLAYER_ELIMINATED") ms += MOMENT_MS.eliminated;
    if (e.type === "TURN_STARTED") ms += MOMENT_MS.turn;
    if (e.type === "BLOCK_DECLARED") ms += MOMENT_MS.block;
  }
  return ms;
}

export type Pace = "relaxed" | "normal" | "fast";

export interface PaceSettings {
  /** Multiplier for bot thinking time and table pauses: >1 slower, <1 faster. */
  speed: number;
  /** Time to challenge or block (R-DG-1). */
  responseTimeoutMs: number;
  /** Time to pick a card to lose or keep (R-DG-3). */
  choiceTimeoutMs: number;
}

export const PACES: Record<Pace, PaceSettings> = {
  relaxed: { speed: 1.6, responseTimeoutMs: 25_000, choiceTimeoutMs: 30_000 },
  normal: { speed: 1, responseTimeoutMs: 15_000, choiceTimeoutMs: 20_000 },
  fast: { speed: 0.55, responseTimeoutMs: 10_000, choiceTimeoutMs: 15_000 },
};
