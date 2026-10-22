// Enumerates every input a player may send right now. Used by bots, UI (to enable buttons) and the
// property tests, which check that each listed input is accepted by applyInput.

import { ACTION_RULES, ACTION_TYPES, RULES } from "./rules";
import {
  alivePlayers,
  canBlockAction,
  canChallengeAction,
  currentAction,
  findPlayer,
  hiddenIndexes,
  isAlive,
  pendingResponders,
} from "./state";
import type { GameState, PlayerId, PlayerInput } from "./types";

export function getLegalInputs(state: GameState, playerId: PlayerId): PlayerInput[] {
  const player = findPlayer(state, playerId);
  if (!player || !isAlive(player)) return [];
  const { phase, phaseId } = state;

  switch (phase.kind) {
    case "AWAIT_ACTION": {
      if (state.turn.actorId !== playerId) return [];
      const mustCoup = player.coins >= RULES.MUST_COUP_AT;
      const targets = alivePlayers(state).filter((p) => p.id !== playerId);
      return ACTION_TYPES.flatMap((action): PlayerInput[] => {
        const rule = ACTION_RULES[action];
        if (mustCoup && action !== "coup") return [];
        if (player.coins < rule.cost) return [];
        if (!rule.targeted) return [{ type: "DECLARE", playerId, phaseId, action }];
        return targets.map((t) => ({
          type: "DECLARE",
          playerId,
          phaseId,
          action,
          targetId: t.id,
        }));
      });
    }
    case "AWAIT_ACTION_RESPONSE": {
      if (!pendingResponders(state).includes(playerId)) return [];
      const inputs: PlayerInput[] = [{ type: "PASS", playerId, phaseId }];
      if (canChallengeAction(state, playerId))
        inputs.push({ type: "CHALLENGE", playerId, phaseId });
      if (canBlockAction(state, playerId)) {
        for (const role of currentAction(state).rule.blockers) {
          inputs.push({ type: "BLOCK", playerId, phaseId, role });
        }
      }
      return inputs;
    }
    case "AWAIT_BLOCK_RESPONSE":
      if (!pendingResponders(state).includes(playerId)) return [];
      return [
        { type: "PASS", playerId, phaseId },
        { type: "CHALLENGE", playerId, phaseId },
      ];
    case "AWAIT_INFLUENCE_LOSS":
      if (phase.playerId !== playerId) return [];
      return hiddenIndexes(player).map((cardIndex) => ({
        type: "CHOOSE_LOSS",
        playerId,
        phaseId,
        cardIndex,
      }));
    case "AWAIT_EXCHANGE":
      if (phase.playerId !== playerId) return [];
      return combinations(phase.options.length, phase.keepCount).map((keep) => ({
        type: "CHOOSE_EXCHANGE",
        playerId,
        phaseId,
        keep,
      }));
    case "GAME_OVER":
      return [];
  }
}

/** All k-element subsets of [0, n), in lexicographic order. */
function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const walk = (start: number, picked: number[]) => {
    if (picked.length === k) {
      result.push(picked);
      return;
    }
    for (let i = start; i < n; i++) walk(i + 1, [...picked, i]);
  };
  walk(0, []);
  return result;
}
