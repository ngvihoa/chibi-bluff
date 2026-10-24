import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES } from "@chibi-bluff/engine";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, defineTheme, getTheme, THEMES, themeAssetUrl } from "./index";

const assetsRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../assets/themes");

describe.each(Object.values(THEMES))("theme $id", (theme) => {
  it("names every role in both languages", () => {
    for (const role of ROLES) {
      expect(theme.roles[role].name.vi.length).toBeGreaterThan(0);
      expect(theme.roles[role].name.en.length).toBeGreaterThan(0);
    }
  });

  it("points only at asset files that exist", () => {
    const paths = [
      theme.cardBack,
      theme.background,
      theme.currency.icon,
      ...ROLES.map((r) => theme.roles[r].art),
    ];
    for (const path of paths) {
      expect(existsSync(join(assetsRoot, theme.id, path)), path).toBe(true);
    }
  });

  it("gives each role a distinct colour", () => {
    const colours = ROLES.map((r) => theme.roles[r].color.toLowerCase());
    expect(new Set(colours).size).toBe(ROLES.length);
  });
});

describe("theme helpers", () => {
  it("returns the default theme", () => {
    expect(getTheme().id).toBe(DEFAULT_THEME_ID);
    expect(() => getTheme("nope")).toThrow();
  });

  it("builds public asset URLs", () => {
    expect(themeAssetUrl(getTheme(), "characters/duke.svg")).toBe(
      "/themes/giang-ho/characters/duke.svg",
    );
  });

  it("rejects malformed manifests with a precise message", () => {
    const good = structuredClone(getTheme());
    expect(() => defineTheme(good)).not.toThrow();
    expect(() => defineTheme({ ...good, roles: { ...good.roles, duke: undefined } })).toThrow(
      /missing role "duke"/,
    );
    expect(() =>
      defineTheme({
        ...good,
        roles: { ...good.roles, captain: { ...good.roles.captain, color: "green" } },
      }),
    ).toThrow(/captain.color/);
    expect(() => defineTheme({ ...good, tagline: { vi: "chỉ tiếng Việt" } })).toThrow(/tagline/);
  });
});
