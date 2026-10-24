// Bot memory: what a seat can learn from the (redacted) event stream (docs/bot-ai.md §4.3).
// Pure: observe() returns a new memory.

import { ACTION_RULES, type GameEvent, type PlayerId, ROLES, type Role } from "@chibi-bluff/engine";
import type { BotMemory, PlayerRecord } from "./types";

const zeroes = (): Record<Role, number> =>
  Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;

const emptyRecord = (): PlayerRecord => ({
  claims: zeroes(),
  declined: zeroes(),
  bluffsCaught: 0,
  truthfulReveals: 0,
  challengesMade: 0,
});

export function createMemory(selfId: PlayerId, playerIds: readonly PlayerId[]): BotMemory {
  return {
    selfId,
    players: Object.fromEntries(playerIds.map((id) => [id, emptyRecord()])),
    grudges: Object.fromEntries(playerIds.map((id) => [id, 0])),
    openClaims: [],
  };
}

export function observe(memory: BotMemory, events: readonly GameEvent[]): BotMemory {
  const next = structuredClone(memory);
  const record = (id: PlayerId) => {
    next.players[id] ??= emptyRecord();
    return next.players[id];
  };
  const settleClaims = (kind?: "action" | "block") => {
    for (const claim of next.openClaims) {
      if (kind === undefined || claim.kind === kind) record(claim.playerId).claims[claim.role] += 1;
    }
    next.openClaims = kind === undefined ? [] : next.openClaims.filter((c) => c.kind !== kind);
  };

  for (const event of events) {
    switch (event.type) {
      case "TURN_STARTED":
        next.openClaims = [];
        break;
      case "ACTION_DECLARED": {
        const { action } = event;
        const claim = ACTION_RULES[action.type].claim;
        if (claim) next.openClaims.push({ playerId: action.actorId, role: claim, kind: "action" });
        if (action.targetId === next.selfId) {
          next.grudges[action.actorId] = (next.grudges[action.actorId] ?? 0) + 1;
        }
        break;
      }
      case "BLOCK_DECLARED":
        next.openClaims.push({
          playerId: event.block.blockerId,
          role: event.block.role,
          kind: "block",
        });
        break;
      case "CHALLENGED":
        record(event.challengerId).challengesMade += 1;
        // The challenged claim is settled by CHALLENGE_RESOLVED, not counted as uncontested.
        next.openClaims = next.openClaims.filter(
          (c) => !(c.playerId === event.claimantId && c.role === event.role),
        );
        break;
      case "CHALLENGE_RESOLVED": {
        const claimant = record(event.claimantId);
        if (event.truthful) {
          // The proven card was shuffled away: old evidence about that role no longer applies.
          claimant.truthfulReveals += 1;
          claimant.claims[event.role] = 0;
          claimant.declined[event.role] = 0;
        } else {
          claimant.bluffsCaught += 1;
        }
        break;
      }
      case "ACTION_RESOLVED": {
        settleClaims("action");
        const { action } = event;
        const rule = ACTION_RULES[action.type];
        // Not blocking is weak evidence of not holding a blocker.
        if (rule.blockableBy === "target" && action.targetId) {
          for (const role of rule.blockers) record(action.targetId).declined[role] += 1;
        }
        break;
      }
      case "ACTION_BLOCKED":
        settleClaims();
        break;
      case "ACTION_FAILED":
        next.openClaims = [];
        break;
      case "EXCHANGE_COMPLETED": {
        const r = record(event.playerId);
        for (const role of ROLES) {
          r.claims[role] = Math.floor(r.claims[role] / 2);
          r.declined[role] = Math.floor(r.declined[role] / 2);
        }
        break;
      }
      default:
        break;
    }
  }
  return next;
}
