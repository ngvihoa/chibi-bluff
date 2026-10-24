// Public API of the bots package (docs/bot-ai.md).

import { easyBot } from "./easy";
import { randomBot } from "./random";
import type { BotPolicy, Difficulty } from "./types";

export { probabilityHolds, unseenCounts } from "./belief";
export { createMemory, observe } from "./memory";
export { PERSONALITIES, type PersonalityName } from "./personality";
export * from "./types";

export function getBot(difficulty: Difficulty): BotPolicy {
  switch (difficulty) {
    case "random":
      return randomBot;
    case "easy":
      return easyBot;
    case "normal":
      throw new Error("Normal bot is not implemented yet");
  }
}
