// Building blocks shared by the messages: room codes, names, settings and player inputs.
// Everything a client sends is parsed with these schemas before it reaches a room or the engine.

import { ACTION_TYPES, type PlayerInput, ROLES, RULES } from "@chibi-bluff/engine";
import { z } from "zod";

/** Bumped whenever a message changes shape; the server refuses other versions. */
export const PROTOCOL_VERSION = 2;

/** Room codes avoid look-alike characters (0/O, 1/I/L) so they can be read out loud. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));

export const NAME_MAX_LENGTH = 16;

/** Drops control and formatting characters, collapses spaces, and trims (docs §5.4). */
export function sanitizeName(raw: string): string {
  return raw
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const nameSchema = z
  .string()
  .max(200)
  .transform(sanitizeName)
  .pipe(z.string().min(1).max(NAME_MAX_LENGTH));

/** Secret the browser keeps to reclaim its seat after a reconnect. */
export const sessionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
export const seatIdSchema = z.string().min(1).max(32);
export const roleSchema = z.enum(ROLES);

// ---------- Room settings (docs/architecture.md §5.1) ----------

export const PACE_OPTIONS = ["relaxed", "normal", "fast"] as const;
/** Seconds to declare an action; 0 = no limit. Never more than 2 minutes (R-DG-7). */
export const ACTION_TIMEOUT_OPTIONS = [0, 30, 60, 120] as const;
export const BOT_DIFFICULTY_OPTIONS = ["easy", "normal"] as const;

export const roomSettingsSchema = z.object({
  pace: z.enum(PACE_OPTIONS),
  actionTimeoutSeconds: z.union(ACTION_TIMEOUT_OPTIONS.map((s) => z.literal(s))),
  botDifficulty: z.enum(BOT_DIFFICULTY_OPTIONS),
  themeId: z.string().regex(/^[a-z0-9-]{1,32}$/),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  pace: "normal",
  actionTimeoutSeconds: 0,
  botDifficulty: "normal",
  themeId: "giang-ho",
};

export const MAX_SEATS = RULES.MAX_PLAYERS;
export const MIN_SEATS_TO_START = RULES.MIN_PLAYERS;

// ---------- Player inputs (mirrors PlayerInput in packages/engine) ----------

const base = { playerId: seatIdSchema, phaseId: z.number().int().nonnegative().optional() };
const index = z.number().int().nonnegative().max(64);

export const playerInputSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("DECLARE"),
    action: z.enum(ACTION_TYPES),
    targetId: seatIdSchema.optional(),
  }),
  z.object({ ...base, type: z.literal("CHALLENGE") }),
  z.object({ ...base, type: z.literal("BLOCK"), role: roleSchema }),
  z.object({ ...base, type: z.literal("PASS") }),
  z.object({ ...base, type: z.literal("CHOOSE_LOSS"), cardIndex: index }),
  z.object({ ...base, type: z.literal("CHOOSE_EXCHANGE"), keep: z.array(index).max(4) }),
  z.object({ ...base, type: z.literal("CHOOSE_REPLACEMENT"), deckIndex: index }),
]);

// The schema and the engine type must describe the same thing.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _inputMatchesEngine: Same<z.infer<typeof playerInputSchema>, PlayerInput> = true;
void _inputMatchesEngine;
