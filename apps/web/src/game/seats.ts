// Builds the seats for a local game: the player plus bots that take on the theme's characters
// as personas (docs/bot-ai.md §8).

import type { Difficulty } from "@chibi-bluff/bots";
import { createRng, ROLES, shuffle } from "@chibi-bluff/engine";
import { botFor, type Pace } from "@chibi-bluff/match";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import type { LocalSeat } from "./local-host";

export const HUMAN_ID = "you";

export interface LocalSetup {
  /** Total players including you: 2–6. */
  players: number;
  difficulty: Difficulty;
  pace: Pace;
  playerName: string;
  /** Picks which characters the bots play. Chosen on the setup screen so it can show them. */
  tableSeed: string;
}

export function createLocalSeats(
  setup: Omit<LocalSetup, "tableSeed">,
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
    bot: botFor(role, setup.difficulty),
  }));
  // The player's avatar is whichever character no bot is playing.
  const free = personas[setup.players - 1] ?? "duke";
  return [{ id: HUMAN_ID, name: setup.playerName, kind: "human", avatar: free }, ...bots];
}
