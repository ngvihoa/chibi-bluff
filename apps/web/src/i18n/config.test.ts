import { describe, expect, it } from "vitest";
import { hasLocale, localeFromAcceptLanguage, withLocale } from "./config";

describe("localeFromAcceptLanguage", () => {
  it("picks the highest-ranked supported language", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,vi;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("fr-FR,vi;q=0.9,en;q=0.8")).toBe("vi");
    expect(localeFromAcceptLanguage("en;q=0.5,vi-VN;q=0.9")).toBe("vi");
  });

  it("falls back to Vietnamese", () => {
    expect(localeFromAcceptLanguage(null)).toBe("vi");
    expect(localeFromAcceptLanguage("ja,ko;q=0.9")).toBe("vi");
    expect(localeFromAcceptLanguage("en;q=0")).toBe("vi");
  });
});

describe("withLocale", () => {
  it("swaps or adds the locale prefix", () => {
    expect(withLocale("/vi/play/local", "en")).toBe("/en/play/local");
    expect(withLocale("/en", "vi")).toBe("/vi");
    expect(withLocale("/room/ABCDE", "en")).toBe("/en/room/ABCDE");
    expect(withLocale("/", "en")).toBe("/en");
  });
});

describe("hasLocale", () => {
  it("accepts only supported locales", () => {
    expect(hasLocale("vi")).toBe(true);
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("fr")).toBe(false);
    expect(hasLocale(undefined)).toBe(false);
  });
});
