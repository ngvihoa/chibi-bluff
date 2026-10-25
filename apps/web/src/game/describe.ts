// Turns engine events into one-line, localized log entries. Events that need no line of their own
// (coin movements, turn starts, passes…) return null.

import { ACTION_RULES, type GameEvent, type PlayerId, type Role } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

export interface DescribeContext {
  dict: Dictionary;
  theme: ThemeManifest;
  locale: ThemeLocale;
  /** Display name for a seat. */
  name: (id: PlayerId) => string;
}

export function describeEvent(event: GameEvent, ctx: DescribeContext): string | null {
  const t = ctx.dict.game.log;
  const role = (r: Role) => ctx.theme.roles[r].name[ctx.locale];

  switch (event.type) {
    case "ACTION_DECLARED": {
      const { action } = event;
      const claim = ACTION_RULES[action.type].claim;
      return format(t[action.type], {
        actor: ctx.name(action.actorId),
        target: action.targetId ? ctx.name(action.targetId) : "",
        role: claim ? role(claim) : "",
      });
    }
    case "ACTION_RESOLVED": {
      // Only actions that could have been challenged or blocked need a "it went through" line;
      // Income and Coup resolve on declaration and Exchange has its own line.
      const { action } = event;
      if (!(action.type in t.resolved)) return null;
      return format(t.resolved[action.type as keyof typeof t.resolved], {
        actor: ctx.name(action.actorId),
        target: action.targetId ? ctx.name(action.targetId) : "",
        currency: ctx.theme.currency[ctx.locale],
      });
    }
    case "CARD_REPLACED":
      // newRole is only present for the player who drew it (event redaction).
      return event.newRole
        ? format(t.drewYou, { role: role(event.newRole) })
        : format(t.drewThem, { player: ctx.name(event.playerId) });
    case "CHALLENGED":
      return format(t.challenged, {
        challenger: ctx.name(event.challengerId),
        claimant: ctx.name(event.claimantId),
      });
    case "CHALLENGE_RESOLVED":
      return format(event.truthful ? t.truthful : t.caught, {
        claimant: ctx.name(event.claimantId),
        role: role(event.role),
      });
    case "BLOCK_DECLARED":
      return format(t.block, {
        blocker: ctx.name(event.block.blockerId),
        role: role(event.block.role),
      });
    case "ACTION_BLOCKED":
      return format(t.blocked, {
        blocker: ctx.name(event.block.blockerId),
        action: ctx.dict.game.actions[event.action.type],
        actor: ctx.name(event.action.actorId),
      });
    case "ACTION_FAILED":
      return event.reason === "TARGET_ELIMINATED" && event.action.targetId
        ? format(t.targetGone, { target: ctx.name(event.action.targetId) })
        : null;
    case "INFLUENCE_LOST":
      return format(t.lost, { player: ctx.name(event.playerId), role: role(event.role) });
    case "PLAYER_ELIMINATED":
      return format(t.eliminated, { player: ctx.name(event.playerId) });
    case "EXCHANGE_COMPLETED":
      return format(t.exchanged, { player: ctx.name(event.playerId) });
    case "GAME_OVER":
      return format(t.won, { player: ctx.name(event.winnerId) });
    default:
      return null;
  }
}
