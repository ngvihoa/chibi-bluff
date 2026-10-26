// Bots take on the theme's characters as personas (docs/bot-ai.md §8).

import {
  type Difficulty,
  PERSONALITIES,
  type Personality,
  type PersonalityName,
} from "@chibi-bluff/bots";
import type { Role } from "@chibi-bluff/engine";

export interface BotSeat {
  difficulty: Difficulty;
  personality: Personality;
}

/** Each character plays with a matching temperament. */
const PERSONA: Record<Role, PersonalityName> = {
  duke: "cautious",
  assassin: "aggressive",
  captain: "bluffer",
  ambassador: "balanced",
  contessa: "vengeful",
};

/** The bot that plays a seat whose avatar is `role`. */
export function botFor(role: Role, difficulty: Difficulty): BotSeat {
  return { difficulty, personality: PERSONALITIES[PERSONA[role]] };
}
