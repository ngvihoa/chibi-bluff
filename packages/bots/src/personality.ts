import type { Personality } from "./types";

/** Preset personalities (docs/bot-ai.md §8). Themes map their characters onto these. */
export const PERSONALITIES = {
  balanced: { bluffRate: 0.35, aggression: 0.4, riskTolerance: 0.4, vindictive: 0.3, chatty: 0.4 },
  bluffer: { bluffRate: 0.7, aggression: 0.35, riskTolerance: 0.6, vindictive: 0.2, chatty: 0.7 },
  cautious: { bluffRate: 0.1, aggression: 0.25, riskTolerance: 0.15, vindictive: 0.1, chatty: 0.2 },
  aggressive: {
    bluffRate: 0.45,
    aggression: 0.7,
    riskTolerance: 0.6,
    vindictive: 0.5,
    chatty: 0.6,
  },
  vengeful: { bluffRate: 0.3, aggression: 0.5, riskTolerance: 0.4, vindictive: 0.9, chatty: 0.5 },
} as const satisfies Record<string, Personality>;

export type PersonalityName = keyof typeof PERSONALITIES;
