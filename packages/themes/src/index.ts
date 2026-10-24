// Theme manifests: everything a theme decides about how the five roles look and are named.
// The engine only knows role ids; see docs/ui-design.md §8.

import { ROLES, type Role } from "@chibi-bluff/engine";
import giangHo from "../../../assets/themes/giang-ho/theme.json";

export type ThemeLocale = "vi" | "en";
export type LocalizedText = Record<ThemeLocale, string>;

export interface RoleSkin {
  name: LocalizedText;
  /** Nickname for a bot playing this character, distinct from every character name. */
  botName: LocalizedText;
  /** Card border / accent colour. */
  color: string;
  /** Card panel gradient, centre → edge. */
  panel: [string, string];
  /** Character art (no text), relative to the theme folder. */
  art: string;
  sticker: { text: LocalizedText };
}

export interface ThemeManifest {
  id: string;
  name: LocalizedText;
  tagline: LocalizedText;
  currency: LocalizedText & { icon: string };
  cardBack: string;
  /** Label printed on the card back ribbon. */
  cardBackLabel: LocalizedText;
  background: string;
  roles: Record<Role, RoleSkin>;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Validates raw JSON into a ThemeManifest, throwing with a precise message when it is malformed. */
export function defineTheme(raw: unknown): ThemeManifest {
  const fail = (msg: string): never => {
    throw new Error(`Invalid theme manifest: ${msg}`);
  };
  const isText = (v: unknown): v is LocalizedText =>
    typeof v === "object" &&
    v !== null &&
    typeof (v as LocalizedText).vi === "string" &&
    typeof (v as LocalizedText).en === "string";

  const t = raw as Partial<ThemeManifest>;
  if (typeof t?.id !== "string" || t.id === "") fail("missing id");
  for (const key of ["name", "tagline", "currency", "cardBackLabel"] as const) {
    if (!isText(t[key])) fail(`"${key}" must have vi and en text`);
  }
  for (const key of ["cardBack", "background"] as const) {
    if (typeof t[key] !== "string") fail(`"${key}" must be a path`);
  }
  if (typeof t.currency?.icon !== "string") fail(`"currency.icon" must be a path`);
  for (const role of ROLES) {
    const skin = t.roles?.[role];
    if (!skin) fail(`missing role "${role}"`);
    const s = skin as RoleSkin;
    if (!isText(s.name)) fail(`${role}.name must have vi and en text`);
    if (!isText(s.botName)) fail(`${role}.botName must have vi and en text`);
    if (!HEX.test(s.color)) fail(`${role}.color must be #rrggbb`);
    if (!Array.isArray(s.panel) || s.panel.length !== 2 || !s.panel.every((c) => HEX.test(c))) {
      fail(`${role}.panel must be two #rrggbb colours`);
    }
    if (typeof s.art !== "string") fail(`${role}.art must be a path`);
    if (!isText(s.sticker?.text)) fail(`${role}.sticker.text must have vi and en text`);
  }
  return t as ThemeManifest;
}

export const THEMES: Readonly<Record<string, ThemeManifest>> = {
  "giang-ho": defineTheme(giangHo),
};

export const DEFAULT_THEME_ID = "giang-ho";

export function getTheme(id: string = DEFAULT_THEME_ID): ThemeManifest {
  const theme = THEMES[id];
  if (!theme) throw new Error(`Unknown theme "${id}"`);
  return theme;
}

/** Public URL of a theme asset (the web app serves assets/themes at /themes). */
export function themeAssetUrl(theme: ThemeManifest, path: string): string {
  return `/themes/${theme.id}/${path}`;
}
