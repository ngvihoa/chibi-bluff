// Bot-vs-bot win rates.
//   pnpm bots:sim --bots easy,random --games 1000
//   pnpm bots:sim --bots easy,easy,random,random --personality cautious

import { parseArgs } from "node:util";
import { getBot } from "../index";
import { PERSONALITIES, type PersonalityName } from "../personality";
import type { Difficulty } from "../types";
import { type SeatSpec, simulateMatch } from "./simulate";

const { values } = parseArgs({
  options: {
    bots: { type: "string", default: "easy,random" },
    games: { type: "string", default: "1000" },
    personality: { type: "string", default: "balanced" },
    seed: { type: "string", default: "cli" },
  },
});

const personalityName = values.personality as PersonalityName;
const personality = PERSONALITIES[personalityName];
if (!personality) {
  console.error(
    `Unknown personality "${values.personality}". Options: ${Object.keys(PERSONALITIES).join(", ")}`,
  );
  process.exit(1);
}
const difficulties = values.bots.split(",").map((d) => d.trim() as Difficulty);
const seats: SeatSpec[] = difficulties.map((d) => ({ label: d, policy: getBot(d), personality }));
const games = Number(values.games);

const started = performance.now();
const result = simulateMatch(seats, games, values.seed);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

console.log(
  `${games} games · ${seats.length} players · personality ${personalityName} · ${seconds}s`,
);
console.log(`average turns: ${result.averageTurns.toFixed(1)}`);
const seatCount = (label: string) => difficulties.filter((d) => d === label).length;
for (const [label, wins] of Object.entries(result.wins)) {
  const fair = seatCount(label) / seats.length;
  const rate = wins / games;
  console.log(
    `${label.padEnd(8)} ${String(wins).padStart(6)} wins  ${(rate * 100).toFixed(1).padStart(5)}%  (fair share ${(fair * 100).toFixed(0)}%)`,
  );
}
