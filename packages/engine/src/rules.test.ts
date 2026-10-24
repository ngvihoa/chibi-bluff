import { describe, expect, it } from "vitest";
import { ACTION_RULES, ACTION_TYPES, createDeck, ROLES, RULES } from "./rules";

describe("court deck", () => {
  it("R-SU-1: has 15 cards, 3 of each of the 5 roles", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(15);
    for (const role of ROLES) {
      expect(deck.filter((r) => r === role)).toHaveLength(3);
    }
  });
});

describe("general actions", () => {
  it("R-AC-1: Income needs no claim and cannot be blocked", () => {
    expect(ACTION_RULES.income).toMatchObject({ cost: 0, claim: null, blockers: [] });
    expect(RULES.INCOME_GAIN).toBe(1);
  });

  it("R-AC-2: Foreign Aid needs no claim and can be blocked by anyone claiming Duke", () => {
    expect(ACTION_RULES.foreignAid).toMatchObject({
      claim: null,
      blockers: ["duke"],
      blockableBy: "anyone",
    });
    expect(RULES.FOREIGN_AID_GAIN).toBe(2);
  });

  it("R-AC-3: Coup costs 7, is targeted, and can be neither challenged nor blocked", () => {
    expect(ACTION_RULES.coup).toMatchObject({
      cost: 7,
      claim: null,
      targeted: true,
      blockers: [],
      blockableBy: null,
    });
  });
});

describe("character actions", () => {
  it("R-AC-4: Tax claims Duke for +3 and cannot be blocked", () => {
    expect(ACTION_RULES.tax).toMatchObject({ claim: "duke", blockers: [] });
    expect(RULES.TAX_GAIN).toBe(3);
  });

  it("R-AC-5: Assassinate claims Assassin, costs 3, only the target may block with Contessa", () => {
    expect(ACTION_RULES.assassinate).toMatchObject({
      cost: 3,
      claim: "assassin",
      targeted: true,
      blockers: ["contessa"],
      blockableBy: "target",
    });
  });

  it("R-AC-6: Steal claims Captain, only the target may block with Captain or Ambassador", () => {
    expect(ACTION_RULES.steal).toMatchObject({
      claim: "captain",
      targeted: true,
      blockers: ["captain", "ambassador"],
      blockableBy: "target",
    });
    expect(RULES.STEAL_MAX).toBe(2);
  });

  it("R-AC-7: Exchange claims Ambassador, draws 2 and cannot be blocked", () => {
    expect(ACTION_RULES.exchange).toMatchObject({ claim: "ambassador", blockers: [] });
    expect(RULES.EXCHANGE_DRAW).toBe(2);
  });
});

describe("rule table consistency", () => {
  it("R-BL-1: only Foreign Aid, Assassinate and Steal are blockable", () => {
    const blockable = ACTION_TYPES.filter((a) => ACTION_RULES[a].blockers.length > 0);
    expect(blockable.sort()).toEqual(["assassinate", "foreignAid", "steal"]);
  });

  it("blockableBy is set exactly when an action has blockers", () => {
    for (const type of ACTION_TYPES) {
      const rule = ACTION_RULES[type];
      expect(rule.blockableBy === null).toBe(rule.blockers.length === 0);
    }
  });

  it("Contessa has no action of its own", () => {
    expect(ACTION_TYPES.some((a) => ACTION_RULES[a].claim === "contessa")).toBe(false);
  });

  it("R-AC-8: must Coup at 10 coins", () => {
    expect(RULES.MUST_COUP_AT).toBe(10);
  });
});
