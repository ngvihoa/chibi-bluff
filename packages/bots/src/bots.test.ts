import { ACTION_RULES, findPlayer, hiddenRoles } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { easyBot } from "./easy";
import { getBot } from "./index";
import { PERSONALITIES } from "./personality";
import { randomBot } from "./random";
import { type SeatSpec, simulateGame, simulateMatch } from "./sim/simulate";
import type { BotPolicy, Personality } from "./types";

const seat = (
  label: string,
  policy: BotPolicy = easyBot,
  personality: Personality = PERSONALITIES.balanced,
): SeatSpec => ({
  label,
  policy,
  personality,
});

describe("bots only send legal inputs", () => {
  // simulateGame throws on any rejected input, so finishing is the assertion.
  it.each([2, 3, 4, 5, 6])("%i easy/random bots finish games without illegal moves", (n) => {
    for (let g = 0; g < 40; g++) {
      const seats = Array.from({ length: n }, (_, i) =>
        i % 2 === 0 ? seat(`easy${i}`) : seat(`random${i}`, randomBot),
      );
      expect(() => simulateGame(seats, `legal-${n}-${g}`)).not.toThrow();
    }
  });
});

describe("easy bot", () => {
  it("never bluffs with bluffRate 0", () => {
    const honest = { ...PERSONALITIES.cautious, bluffRate: 0 };
    let checked = 0;
    for (let g = 0; g < 60; g++) {
      simulateGame(
        [seat("a", easyBot, honest), seat("b", easyBot, honest), seat("c", easyBot, honest)],
        `honest-${g}`,
        (state, _seat, { input }) => {
          const player = findPlayer(state, input.playerId);
          if (!player) return;
          const held = hiddenRoles(player);
          if (input.type === "DECLARE") {
            const claim = ACTION_RULES[input.action].claim;
            if (claim) {
              checked++;
              expect(held).toContain(claim);
            }
          }
          // The only allowed exception: a desperate Contessa when assassinated on the last card.
          if (input.type === "BLOCK" && !held.includes(input.role)) {
            expect(input.role).toBe("contessa");
            expect(held).toHaveLength(1);
          }
        },
      );
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("suggests a human-like thinking delay", () => {
    const delays: number[] = [];
    simulateGame([seat("a"), seat("b"), seat("c")], "think", (_state, _seat, decision) => {
      delays.push(decision.thinkMs);
    });
    expect(delays.length).toBeGreaterThan(10);
    for (const ms of delays) {
      expect(ms).toBeGreaterThanOrEqual(500);
      expect(ms).toBeLessThanOrEqual(2_500);
    }
  });

  it("beats random play clearly (2 players, 400 games)", () => {
    const result = simulateMatch([seat("easy"), seat("random", randomBot)], 400, "easy-vs-random");
    expect(result.winRate.easy).toBeGreaterThan(0.62);
  });
});

describe("getBot", () => {
  it("returns the policy for each implemented difficulty", () => {
    expect(getBot("random").difficulty).toBe("random");
    expect(getBot("easy").difficulty).toBe("easy");
  });
});
