"use client";

// A one-time nudge towards the storyboard (docs/ui-design.md §10.1). Shown once to anyone who has
// never opened /rules/learn, on the screens where a game starts; never again after that, whether
// they follow it, skip it or just play.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

const KEY = "chibi-bluff:learn-hint";

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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (seen()) return;
    setVisible(true);
    markLearnSeen();
  }, []);

  if (!visible) return null;
  return (
    <aside
      role="note"
      className="flex animate-[pop-in_300ms_both] flex-col gap-3 rounded-3xl border-3 border-outline bg-gold p-4 text-outline shadow-hard-sm"
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
          onClick={() => setVisible(false)}
          className="rounded-2xl border-3 border-outline bg-panel px-4 py-2 font-extrabold text-ink shadow-hard-sm"
        >
          {t.skip}
        </button>
      </div>
    </aside>
  );
}
