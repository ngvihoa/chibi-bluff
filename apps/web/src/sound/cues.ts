// Which sounds a batch of game events plays (docs/ui-design.md §7). Pure, so it is tested
// without audio. The challenge and elimination moments, the game-over screen, the incense timer
// and stickers play their own sounds where they appear on screen, in step with their animations.

import type { GameEvent, PlayerId } from "@chibi-bluff/engine";

export const SOUND_IDS = [
  "deal",
  "turn",
  "declare",
  "coinGain",
  "coinLoss",
  "challenge",
  "caught",
  "truthful",
  "block",
  "loseCard",
  "eliminated",
  "win",
  "lose",
  "tick",
  "sticker",
] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/** A sound and how long after the batch arrives it starts. */
export interface Cue {
  id: SoundId;
  delayMs: number;
}

/** Gap between sounds of one batch, so they do not land on top of each other. */
export const CUE_GAP_MS = 180;

/** When the verdict stamp lands in the challenge moment (components/table/moments.tsx). */
export const VERDICT_DELAY_MS = 1_000;

export function cuesFor(events: GameEvent[], viewerId: PlayerId | null): Cue[] {
  const ids: SoundId[] = [];
  const add = (id: SoundId) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const e of events) {
    switch (e.type) {
      case "GAME_STARTED":
        add("deal");
        break;
      case "ACTION_DECLARED":
        add("declare");
        break;
      case "BLOCK_DECLARED":
        add("block");
        break;
      case "COINS_CHANGED":
        // An eliminated player's coins just leave the table: no sound for that.
        if (e.reason !== "ELIMINATED") add(e.delta > 0 ? "coinGain" : "coinLoss");
        break;
      case "INFLUENCE_LOST":
        add("loseCard");
        break;
      case "TURN_STARTED":
        if (e.playerId === viewerId) add("turn");
        break;
    }
  }
  return ids.map((id, i) => ({ id, delayMs: i * CUE_GAP_MS }));
}
