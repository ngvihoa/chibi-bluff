"use client";

import { PACES } from "@chibi-bluff/match";
import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LearnHint } from "@/components/rules/learn-hint";
import { GameTable } from "@/components/table/game-table";
import { LocalHost } from "@/game/local-host";
import { createLocalSeats, type LocalSetup } from "@/game/seats";
import { useI18n } from "@/i18n/client";
import { SetupForm } from "./setup-form";

/** `?speed=0.1` overrides the chosen pace (end-to-end tests use it to run 10× faster). */
function speedFromUrl(): number | null {
  const value = Number(new URLSearchParams(window.location.search).get("speed"));
  return Number.isFinite(value) && value > 0 ? Math.min(2, Math.max(0.05, value)) : null;
}

/** Local game against bots: setup screen, then the table. Runs entirely in the browser. */
export function LocalGame() {
  const { locale, dict } = useI18n();
  const theme = getTheme();
  const [setup, setSetup] = useState<LocalSetup | null>(null);
  const [host, setHost] = useState<LocalHost | null>(null);
  // Who sits at the table, picked before the game so the setup screen can show them. Made in an
  // effect: a random value rendered on the server would never match the browser's.
  const [tableSeed, setTableSeed] = useState<string | null>(null);
  useEffect(() => {
    if (!tableSeed) setTableSeed(crypto.randomUUID());
  }, [tableSeed]);

  // One host per game; recreated for "new game", disposed when leaving the page.
  useEffect(() => {
    if (!setup) return;
    const seed = crypto.randomUUID();
    const next = new LocalHost({
      seats: createLocalSeats(setup, theme, locale, setup.tableSeed),
      seed,
      timeouts: {
        responseTimeoutMs: PACES[setup.pace].responseTimeoutMs,
        choiceTimeoutMs: PACES[setup.pace].choiceTimeoutMs,
        // R-DG-7: no action timer against bots.
        actionTimeoutMs: null,
      },
      speed: speedFromUrl() ?? PACES[setup.pace].speed,
    });
    setHost(next);
    return () => next.dispose();
  }, [setup, theme, locale]);

  // With cacheComponents, Next keeps a page the player left alive (hidden) and shows it again
  // when they come back, state and all. Coming back should open the setup screen, not start a
  // fresh game with the old settings.
  useEffect(
    () => () => {
      setSetup(null);
      setHost(null);
      setTableSeed(null);
    },
    [],
  );

  if (setup && host) {
    return <GameTable host={host} theme={theme} onNewGame={() => setSetup({ ...setup })} />;
  }

  return (
    // Desktop (docs/ui-design.md §4.2b): the form, with a preview of the table beside it.
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6 lg:max-w-[1120px] lg:px-8 lg:pt-10">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
          {dict.common.back}
        </Link>
        <h1 className="text-game text-3xl lg:text-5xl">{dict.game.setup.title}</h1>
      </div>
      <LearnHint />
      <SetupForm
        onStart={setSetup}
        tableSeed={tableSeed}
        onShuffle={() => setTableSeed(crypto.randomUUID())}
      />
    </main>
  );
}
