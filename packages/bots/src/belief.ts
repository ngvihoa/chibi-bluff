// Card counting and per-opponent role probabilities (docs/bot-ai.md §4).

import { type PlayerId, type PlayerView, ROLES, type Role, RULES } from "@chibi-bluff/engine";
import type { BotMemory } from "./types";

/** Copies of each role the viewer cannot see: 3 − own face-down − all face-up (§4.1). */
export function unseenCounts(view: PlayerView): Record<Role, number> {
  const counts = Object.fromEntries(ROLES.map((r) => [r, RULES.CARDS_PER_ROLE])) as Record<
    Role,
    number
  >;
  for (const player of view.players) {
    for (const card of player.cards) {
      if (card.role !== null && (card.revealed || player.id === view.viewerId)) {
        counts[card.role] -= 1;
      }
    }
  }
  return counts;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

/** P(at least one of `copies` specific cards among `k` drawn from `pool`) — §4.2. */
export function hypergeometricAtLeastOne(pool: number, copies: number, k: number): number {
  if (copies <= 0 || k <= 0) return 0;
  if (pool <= 0) return 0;
  return 1 - choose(pool - copies, k) / choose(pool, k);
}

const CLAIM_FACTOR = 1.6;
const DISTRUSTED_CLAIM_FACTOR = 1.2;
const MAX_CLAIM_BOOST = 4;
const DECLINE_FACTOR = 0.6;

/** Estimated P(player holds at least one face-down `role`), from the viewer's perspective. */
export function probabilityHolds(
  view: PlayerView,
  memory: BotMemory,
  playerId: PlayerId,
  role: Role,
): number {
  const player = view.players.find((p) => p.id === playerId);
  if (!player) return 0;
  if (playerId === view.viewerId) {
    return player.cards.some((c) => !c.revealed && c.role === role) ? 1 : 0;
  }
  const hidden = player.cards.filter((c) => !c.revealed).length;
  const unseen = unseenCounts(view)[role];
  if (hidden === 0 || unseen === 0) return 0;

  const pool =
    view.deckSize +
    view.players
      .filter((p) => p.id !== view.viewerId)
      .reduce((sum, p) => sum + p.cards.filter((c) => !c.revealed).length, 0);
  const base = hypergeometricAtLeastOne(pool, unseen, hidden);
  if (base >= 1) return 1;

  const record = memory.players[playerId];
  if (!record) return base;
  const perClaim = record.bluffsCaught > 0 ? DISTRUSTED_CLAIM_FACTOR : CLAIM_FACTOR;
  const boost = Math.min(MAX_CLAIM_BOOST, perClaim ** record.claims[role]);
  const factor = boost * DECLINE_FACTOR ** record.declined[role];
  const odds = (base / (1 - base)) * factor;
  return odds / (1 + odds);
}
