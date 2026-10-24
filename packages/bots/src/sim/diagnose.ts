// Per-bot behaviour statistics for tuning: how often each bot bluffs, challenges and wins them.
//   pnpm --filter @chibi-bluff/bots exec tsx src/sim/diagnose.ts normal,easy 1000

import { ACTION_RULES, findPlayer, hiddenRoles } from "@chibi-bluff/engine";
import { getBot } from "../index";
import { PERSONALITIES } from "../personality";
import type { Difficulty } from "../types";
import { type SeatSpec, simulateGame } from "./simulate";

const [botsArg = "normal,easy", gamesArg = "1000"] = process.argv.slice(2);
const labels = botsArg.split(",") as Difficulty[];
const seats: SeatSpec[] = labels.map((d) => ({
  label: d,
  policy: getBot(d),
  personality: PERSONALITIES.balanced,
}));

type Stats = Record<string, number>;
const stats: Record<string, Stats> = {};
const bump = (label: string, key: string) => {
  stats[label] ??= {};
  stats[label][key] = (stats[label][key] ?? 0) + 1;
};

for (let g = 0; g < Number(gamesArg); g++) {
  const seating = g % 2 === 0 ? seats : [...seats].reverse();
  const result = simulateGame(seating, `diag-${g}`, (state, seat, { input }) => {
    const me = findPlayer(state, input.playerId);
    if (!me) return;
    const held = hiddenRoles(me);
    if (input.type === "DECLARE") {
      bump(seat.label, `action:${input.action}`);
      const claim = ACTION_RULES[input.action].claim;
      if (claim && !held.includes(claim)) bump(seat.label, "bluff:action");
    }
    if (input.type === "BLOCK") {
      bump(seat.label, held.includes(input.role) ? "block:honest" : "bluff:block");
    }
    if (input.type === "CHALLENGE") {
      const claimant =
        state.phase.kind === "AWAIT_BLOCK_RESPONSE"
          ? state.turn.block?.blockerId
          : state.turn.actorId;
      const role =
        state.phase.kind === "AWAIT_BLOCK_RESPONSE"
          ? state.turn.block?.role
          : state.turn.action && ACTION_RULES[state.turn.action.type].claim;
      const c = claimant ? findPlayer(state, claimant) : undefined;
      const right = c && role ? !hiddenRoles(c).includes(role) : false;
      bump(seat.label, right ? "challenge:right" : "challenge:wrong");
    }
  });
  bump(result.winner, "WINS");
}
for (const [label, s] of Object.entries(stats)) {
  console.log(`\n${label}`);
  for (const [k, v] of Object.entries(s).sort()) console.log(`  ${k.padEnd(20)} ${v}`);
}
