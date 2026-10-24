"use client";

import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GameTable } from "@/components/table/game-table";
import { LocalHost } from "@/game/local-host";
import { createLocalSeats, type LocalSetup } from "@/game/seats";
import { useI18n } from "@/i18n/client";
import { SetupForm } from "./setup-form";

/** `?speed=0.1` makes bots think 10× faster (used by end-to-end tests). */
function speedFromUrl(): number {
  const value = Number(new URLSearchParams(window.location.search).get("speed"));
  return Number.isFinite(value) && value > 0 ? Math.min(1, Math.max(0.05, value)) : 1;
}

/** Local game against bots: setup screen, then the table. Runs entirely in the browser. */
export function LocalGame() {
  const { locale, dict } = useI18n();
  const theme = getTheme();
  const [setup, setSetup] = useState<LocalSetup | null>(null);
  const [host, setHost] = useState<LocalHost | null>(null);

  // One host per game; recreated for "new game", disposed when leaving the page.
  useEffect(() => {
    if (!setup) return;
    const seed = crypto.randomUUID();
    const next = new LocalHost({
      seats: createLocalSeats(setup, theme, locale, seed),
      seed,
      // R-DG-7: no action timer against bots.
      timeouts: { actionTimeoutMs: null },
      speed: speedFromUrl(),
    });
    setHost(next);
    return () => next.dispose();
  }, [setup, theme, locale]);

  if (setup && host) {
    return <GameTable host={host} theme={theme} onNewGame={() => setSetup({ ...setup })} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl">{dict.game.setup.title}</h1>
      </div>
      <SetupForm onStart={setSetup} />
    </main>
  );
}
