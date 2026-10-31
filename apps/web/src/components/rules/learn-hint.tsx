"use client";

// A one-time nudge towards the storyboard (docs/ui-design.md §10.1). Shown once to anyone who has
// never opened /rules/learn, on the screens where a game starts; never again after that, whether
// they follow it, skip it or just play.

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEARN_HINT_KEY as KEY } from "./learn-hint-key";

/** Remembers that the storyboard was seen (or the hint shown), so the hint stays away. */
export function markLearnSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the hint may come back; it is only a hint.
  }
}

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function LearnHint() {
  const { locale, dict } = useI18n();
  const t = dict.rules.firstTime;
  // "unknown" until mounted: then the <html data-learn-hint> mark set before the first paint
  // (LEARN_HINT_SCRIPT) decides, so the hint never pops in and shifts the page.
  const [state, setState] = useState<"unknown" | "show" | "hide">("unknown");

  // Decided once per mount. Effects can run again (React's development double run, or the page
  // coming back from Next's hidden cache), and by then the visit is already marked as seen.
  const decided = useRef(false);
  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    setState(seen() ? "hide" : "show");
    markLearnSeen();
  }, []);

  // Once state has taken over, drop the mark: other pages reached without a reload must not show
  // the hint again. A layout effect, so no frame is painted between the two.
  useLayoutEffect(() => {
    if (state !== "unknown") delete document.documentElement.dataset.learnHint;
  }, [state]);

  if (state === "hide") return null;
  return (
    <aside
      role="note"
      className={`flex-col gap-3 ${
        state === "show" ? "flex" : "hidden [[data-learn-hint=new]_&]:flex"
      } rounded-3xl border-3 border-outline bg-gold p-4 text-outline shadow-hard-sm`}
    >
      <p className="font-extrabold">{t.text}</p>
      <div className="flex gap-2">
        <Link
          href={`/${locale}/rules/learn`}
          className="flex-1 rounded-2xl border-3 border-outline bg-danger py-2 text-center font-extrabold text-ink shadow-hard-sm"
        >
          {t.learn}
        </Link>
        <button
          type="button"
          onClick={() => setState("hide")}
          className="rounded-2xl border-3 border-outline bg-panel px-4 py-2 font-extrabold text-ink shadow-hard-sm"
        >
          {t.skip}
        </button>
      </div>
    </aside>
  );
}
