// Static rule data. Each entry cites its rule code in docs/game-rules.md.

export const ROLES = ["duke", "assassin", "captain", "ambassador", "contessa"] as const;
export type Role = (typeof ROLES)[number];

export const ACTION_TYPES = [
  "income",
  "foreignAid",
  "coup",
  "tax",
  "assassinate",
  "steal",
  "exchange",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface ActionRule {
  /** Coins paid when the action is declared (R-AC-11). */
  cost: number;
  /** Character the actor claims; null for general actions that cannot be challenged. */
  claim: Role | null;
  targeted: boolean;
  /** Characters that can block this action (R-BL-1). */
  blockers: readonly Role[];
  /** Who may block: any other living player, or only the target. */
  blockableBy: "anyone" | "target" | null;
}

export const ACTION_RULES: Readonly<Record<ActionType, ActionRule>> = {
  // R-AC-1
  income: { cost: 0, claim: null, targeted: false, blockers: [], blockableBy: null },
  // R-AC-2
  foreignAid: { cost: 0, claim: null, targeted: false, blockers: ["duke"], blockableBy: "anyone" },
  // R-AC-3
  coup: { cost: 7, claim: null, targeted: true, blockers: [], blockableBy: null },
  // R-AC-4
  tax: { cost: 0, claim: "duke", targeted: false, blockers: [], blockableBy: null },
  // R-AC-5
  assassinate: {
    cost: 3,
    claim: "assassin",
    targeted: true,
    blockers: ["contessa"],
    blockableBy: "target",
  },
  // R-AC-6
  steal: {
    cost: 0,
    claim: "captain",
    targeted: true,
    blockers: ["captain", "ambassador"],
    blockableBy: "target",
  },
  // R-AC-7
  exchange: { cost: 0, claim: "ambassador", targeted: false, blockers: [], blockableBy: null },
};

export const RULES = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  CARDS_PER_ROLE: 3, // R-SU-1
  STARTING_CARDS: 2, // R-SU-1
  STARTING_COINS: 2, // R-SU-2
  TWO_PLAYER_FIRST_PLAYER_COINS: 1, // R-SU-4
  MUST_COUP_AT: 10, // R-AC-8
  INCOME_GAIN: 1, // R-AC-1
  FOREIGN_AID_GAIN: 2, // R-AC-2
  TAX_GAIN: 3, // R-AC-4
  STEAL_MAX: 2, // R-AC-6
  EXCHANGE_DRAW: 2, // R-AC-7
} as const;

/** Unshuffled court deck: 3 copies of each role (R-SU-1). */
export function createDeck(): Role[] {
  return ROLES.flatMap((role) => Array<Role>(RULES.CARDS_PER_ROLE).fill(role));
}
