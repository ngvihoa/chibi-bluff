"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALES, type Locale, withLocale } from "@/i18n/config";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function rememberLocale(locale: Locale) {
  if ("cookieStore" in window) {
    void window.cookieStore.set({
      name: LOCALE_COOKIE,
      value: locale,
      path: "/",
      expires: Date.now() + ONE_YEAR_MS,
      sameSite: "lax",
    });
    return;
  }
  // biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without the Cookie Store API
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** VI / EN pill. Remembers the choice in a cookie so locale-less invite links use it too. */
export function LanguageSwitch() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();

  return (
    <nav
      aria-label={dict.common.language}
      className="flex rounded-full border-3 border-outline bg-panel p-1 shadow-hard-sm"
    >
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={withLocale(pathname, l)}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          onClick={() => rememberLocale(l)}
          className="min-w-11 rounded-full px-3 py-1 text-center text-sm font-extrabold uppercase text-muted aria-[current]:bg-gold aria-[current]:text-outline"
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
