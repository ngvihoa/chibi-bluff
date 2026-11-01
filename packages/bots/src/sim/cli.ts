// Bot-vs-bot win rates.
//   pnpm bots:sim --bots easy,random --games 1000
//   pnpm bots:sim --bots easy,easy,random,random --personality cautious
//   pnpm bots:sim --bots hard,normal --games 200 --time 250   (hard = PIMC; ismcts to compare)

import { parseArgs } from "node:util";
import { createHardBot, getBot } from "../index";
import { PERSONALITIES, type PersonalityName } from "../personality";
import type { Difficulty } from "../types";
import { type SeatSpec, simulateMatch } from "./simulate";

const { values } = parseArgs({
  options: {
    bots: { type: "string", default: "easy,random" },
    games: { type: "string", default: "1000" },
    personality: { type: "string", default: "balanced" },
    seed: { type: "string", default: "cli" },
    /** Thinking time per move of the hard bot (and ISMCTS, kept for comparison) (ms). */
    time: { type: "string", default: "250" },
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
const difficulties = values.bots.split(",").map((d) => d.trim());
const timeMs = Number(values.time);
const policyFor = (label: string) =>
  label === "hard" || label === "ismcts"
    ? createHardBot({ algorithm: label === "ismcts" ? "ismcts" : "pimc", timeMs })
    : getBot(label as Difficulty);
const seats: SeatSpec[] = difficulties.map((d) => ({
  label: d,
  policy: policyFor(d),
  personality,
}));
const games = Number(values.games);

const started = performance.now();
const result = simulateMatch(seats, games, values.seed);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

console.log(
  `${games} games · ${seats.length} players · personality ${personalityName} · ${seconds}s` +
    (difficulties.some((d) => d === "hard" || d === "ismcts")
      ? ` · ${timeMs} ms per hard move`
      : ""),
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
