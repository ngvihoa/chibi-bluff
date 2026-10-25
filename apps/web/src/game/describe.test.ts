import type { GameEvent } from "@chibi-bluff/engine";
import { getTheme } from "@chibi-bluff/themes";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import vi from "@/i18n/dictionaries/vi.json";
import { describeEvent } from "./describe";

const theme = getTheme();
const names: Record<string, string> = { you: "Bạn", "bot-1": "Lão Tiền", "bot-2": "Tiểu Ảnh" };
const ctx = (locale: "vi" | "en") => ({
  dict: locale === "vi" ? vi : en,
  theme,
  locale,
  name: (id: string) => names[id] ?? id,
});

describe("describeEvent", () => {
  it("describes claims with the theme's character names", () => {
    const event: GameEvent = {
      type: "ACTION_DECLARED",
      action: { type: "steal", actorId: "bot-1", targetId: "you" },
    };
    expect(describeEvent(event, ctx("vi"))).toBe("Lão Tiền xưng Đệ Tử Cái Bang để Cướp của Bạn");
    expect(describeEvent(event, ctx("en"))).toBe(
      "Lão Tiền claims Beggar Clan Rascal to steal from Bạn",
    );
  });

  it("distinguishes a caught bluff from a truthful claim", () => {
    const base = {
      type: "CHALLENGE_RESOLVED",
      challengerId: "you",
      claimantId: "bot-2",
      role: "assassin",
    } as const;
    expect(describeEvent({ ...base, truthful: false }, ctx("vi"))).toBe(
      "Lộ tẩy! Tiểu Ảnh không có Ảnh Sát Thủ",
    );
    expect(describeEvent({ ...base, truthful: true }, ctx("en"))).toBe(
      "The real deal! Tiểu Ảnh has Shadow Blade",
    );
  });

  it("says when a challengeable action goes through, but not for Income or Coup", () => {
    const resolved = (type: "tax" | "steal" | "income" | "coup"): GameEvent => ({
      type: "ACTION_RESOLVED",
      action: {
        type,
        actorId: "bot-1",
        targetId: type === "steal" || type === "coup" ? "you" : null,
      },
    });
    expect(describeEvent(resolved("tax"), ctx("vi"))).toBe(
      "Thu thuế thành công: Lão Tiền +3 lượng",
    );
    expect(describeEvent(resolved("steal"), ctx("en"))).toBe(
      "Steal goes through: Lão Tiền robs Bạn",
    );
    expect(describeEvent(resolved("income"), ctx("vi"))).toBeNull();
    expect(describeEvent(resolved("coup"), ctx("vi"))).toBeNull();
  });

  it("says who blocked what", () => {
    const event: GameEvent = {
      type: "ACTION_BLOCKED",
      action: { type: "foreignAid", actorId: "bot-1", targetId: null },
      block: { blockerId: "bot-2", role: "duke" },
    };
    expect(describeEvent(event, ctx("vi"))).toBe("Tiểu Ảnh chặn được Viện trợ của Lão Tiền");
    expect(describeEvent(event, ctx("en"))).toBe("Tiểu Ảnh blocks Lão Tiền's Foreign aid");
  });

  it("tells you which card you drew, and only that someone else drew one", () => {
    expect(
      describeEvent({ type: "CARD_REPLACED", playerId: "you", newRole: "captain" }, ctx("vi")),
    ).toBe("Bạn rút lá mới: Đệ Tử Cái Bang");
    expect(
      describeEvent({ type: "CARD_REPLACED", playerId: "bot-1", newRole: null }, ctx("en")),
    ).toBe("Lão Tiền drew a new card");
  });

  it("skips events that need no log line", () => {
    expect(describeEvent({ type: "PASSED", playerId: "you" }, ctx("vi"))).toBeNull();
    expect(
      describeEvent(
        { type: "COINS_CHANGED", playerId: "you", delta: 1, reason: "INCOME" },
        ctx("vi"),
      ),
    ).toBeNull();
  });

  it("leaves no unfilled placeholders for any action", () => {
    for (const type of [
      "income",
      "foreignAid",
      "coup",
      "tax",
      "assassinate",
      "steal",
      "exchange",
    ] as const) {
      const event: GameEvent = {
        type: "ACTION_DECLARED",
        action: { type, actorId: "you", targetId: "bot-1" },
      };
      for (const locale of ["vi", "en"] as const) {
        expect(describeEvent(event, ctx(locale))).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
