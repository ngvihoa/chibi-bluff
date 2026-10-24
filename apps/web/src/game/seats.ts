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

export interface LocalSetup {
  /** Total players including you: 2–6. */
  players: number;
  difficulty: Difficulty;
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
