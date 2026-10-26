import { describe, expect, it } from "vitest";
import {
  nameSchema,
  PROTOCOL_VERSION,
  parseClientMessage,
  ROOM_CODE_ALPHABET,
  roomCodeSchema,
  roomSettingsSchema,
  sanitizeName,
} from "./index";

describe("room codes", () => {
  it("accept 5 unambiguous characters, any case", () => {
    expect(roomCodeSchema.parse(" abcd2 ")).toBe("ABCD2");
    for (const bad of ["ABCD", "ABCDEF", "ABCD0", "ABCDO", "ABCD1", "ABCDI", "ABCDL"]) {
      expect(roomCodeSchema.safeParse(bad).success).toBe(false);
    }
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
});

describe("names (docs/architecture.md §5.4)", () => {
  it("strips control characters and extra spaces", () => {
    expect(sanitizeName("  Tiểu\u0000  Long​\n ")).toBe("Tiểu Long");
    expect(nameSchema.parse("  Bạch   Y ")).toBe("Bạch Y");
  });

  it("refuses empty and over-long names", () => {
    expect(nameSchema.safeParse(" \u0007 ").success).toBe(false);
    expect(nameSchema.safeParse("x".repeat(17)).success).toBe(false);
    expect(nameSchema.safeParse("x".repeat(16)).success).toBe(true);
  });
});

describe("room settings", () => {
  it("caps the action timer at 2 minutes (R-DG-7)", () => {
    const ok = {
      pace: "fast",
      actionTimeoutSeconds: 120,
      botDifficulty: "easy",
      themeId: "giang-ho",
    };
    expect(roomSettingsSchema.safeParse(ok).success).toBe(true);
    expect(roomSettingsSchema.safeParse({ ...ok, actionTimeoutSeconds: 180 }).success).toBe(false);
    expect(roomSettingsSchema.safeParse({ ...ok, actionTimeoutSeconds: 45 }).success).toBe(false);
  });
});

describe("parseClientMessage", () => {
  it("accepts a well-formed join", () => {
    const result = parseClientMessage("room:join", {
      protocolVersion: PROTOCOL_VERSION,
      code: "abcde",
      name: "An",
    });
    expect(result).toEqual({
      ok: true,
      data: { protocolVersion: PROTOCOL_VERSION, code: "ABCDE", name: "An" },
    });
  });

  it("tells an outdated client apart from a malformed message", () => {
    expect(
      parseClientMessage("room:join", { protocolVersion: 0, code: "ABCDE", name: "An" }),
    ).toEqual({ ok: false, error: "VERSION_MISMATCH" });
    expect(parseClientMessage("room:join", { protocolVersion: PROTOCOL_VERSION })).toEqual({
      ok: false,
      error: "BAD_REQUEST",
    });
  });

  it("validates game inputs field by field", () => {
    const send = (input: unknown) => parseClientMessage("game:input", { input }).ok;
    expect(send({ type: "DECLARE", playerId: "p1", action: "steal", targetId: "p2" })).toBe(true);
    expect(send({ type: "CHOOSE_EXCHANGE", playerId: "p1", keep: [0, 2], phaseId: 7 })).toBe(true);
    expect(send({ type: "DECLARE", playerId: "p1", action: "rob" })).toBe(false);
    expect(send({ type: "BLOCK", playerId: "p1", role: "joker" })).toBe(false);
    expect(send({ type: "CHOOSE_LOSS", playerId: "p1", cardIndex: -1 })).toBe(false);
    expect(send({ type: "TIMEOUT" })).toBe(false); // only the server times out
  });
});
