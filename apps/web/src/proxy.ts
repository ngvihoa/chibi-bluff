// Adds a locale prefix to locale-less URLs (e.g. a shared /room/ABCDE invite), choosing the
// visitor's saved language first, then their browser language. See docs/decisions/0005.

import { type NextRequest, NextResponse } from "next/server";
import { hasLocale, LOCALE_COOKIE, LOCALES, localeFromAcceptLanguage } from "@/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasPrefix = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasPrefix) return;

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(saved)
    ? saved
    : localeFromAcceptLanguage(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, theme assets and any file with an extension (icons, images…).
  matcher: ["/((?!_next|themes|.*\\..*).*)"],
};
