// Server-side dictionary loading (Next.js i18n guide). Client components receive the dictionary
// through <I18nProvider> instead of importing this file.

import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./config";
import type vi from "./dictionaries/vi.json";

/** Vietnamese is the source of truth; every other dictionary must have the same shape. */
export type Dictionary = typeof vi;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  vi: () => import("./dictionaries/vi.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}
