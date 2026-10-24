// Locale settings shared by the proxy, server components and client components.

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
/** Remembers an explicit language choice so locale-less links (e.g. room invites) honour it. */
export const LOCALE_COOKIE = "locale";

export function hasLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Picks the first supported language from an Accept-Language header. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  const match = ranked.find((entry) => hasLocale(entry.lang));
  return hasLocale(match?.lang) ? match.lang : DEFAULT_LOCALE;
}

/** Swaps the locale prefix of a pathname: /vi/play → /en/play. */
export function withLocale(pathname: string, locale: Locale): string {
  if (pathname === "/") return `/${locale}`;
  const segments = pathname.split("/");
  if (hasLocale(segments[1])) segments[1] = locale;
  else segments.splice(1, 0, locale);
  return segments.join("/");
}
