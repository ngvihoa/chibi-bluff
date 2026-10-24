// Builds the seats for a local game: the player plus bots that take on the theme's characters
// as personas (docs/bot-ai.md §8).

import { type Difficulty, PERSONALITIES, type PersonalityName } from "@chibi-bluff/bots";
import { createRng, ROLES, type Role, shuffle } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import type { LocalSeat } from "./local-host";

/** Each character plays with a matching temperament. */
const PERSONA: Record<Role, PersonalityName> = {
  duke: "cautious",
  assassin: "aggressive",
  captain: "bluffer",
  ambassador: "balanced",
  contessa: "vengeful",
};

export const HUMAN_ID = "you";

export type Pace = "relaxed" | "normal" | "fast";

export interface PaceSettings {
  /** Multiplier for bot thinking time and table pauses (LocalHost `speed`). */
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

export interface LocalSetup {
  /** Total players including you: 2–6. */
  players: number;
  difficulty: Difficulty;
  pace: Pace;
  playerName: string;
}

export function createLocalSeats(
  setup: LocalSetup,
  theme: ThemeManifest,
  locale: ThemeLocale,
  seed: string,
): LocalSeat[] {
  const [personas] = shuffle(ROLES, createRng(`${seed}:personas`));
  const bots: LocalSeat[] = personas.slice(0, setup.players - 1).map((role, i) => ({
    id: `bot-${i + 1}`,
    name: theme.roles[role].botName[locale],
    kind: "bot",
    avatar: role,
    bot: { difficulty: setup.difficulty, personality: PERSONALITIES[PERSONA[role]] },
  }));
  // The player's avatar is whichever character no bot is playing.
  const free = personas[setup.players - 1] ?? "duke";
  return [{ id: HUMAN_ID, name: setup.playerName, kind: "human", avatar: free }, ...bots];
}
