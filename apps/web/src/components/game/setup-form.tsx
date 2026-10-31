"use client";

import { RULES } from "@chibi-bluff/engine";
import { getTheme } from "@chibi-bluff/themes";
import Link from "next/link";
import { useState } from "react";
import { Choice } from "@/components/choice";
import { GameButton } from "@/components/game-button";
import { Avatar } from "@/components/table/avatar";
import { createLocalSeats, type LocalSetup } from "@/game/seats";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";

const PLAYER_COUNTS = Array.from(
  { length: RULES.MAX_PLAYERS - RULES.MIN_PLAYERS + 1 },
  (_, i) => i + RULES.MIN_PLAYERS,
);
/** Difficulties offered to players (the random bot is only a testing baseline). */
const DIFFICULTIES = ["easy", "normal"] as const;
const PACE_ORDER = ["relaxed", "normal", "fast"] as const;
const PACE_TEXT = {
  relaxed: ["relaxed", "relaxedHint"],
  normal: ["normalPace", "normalPaceHint"],
  fast: ["fast", "fastHint"],
} as const;

export function SetupForm({
  onStart,
  tableSeed,
  onShuffle,
}: {
  onStart: (setup: LocalSetup) => void;
  /** Who the bots will be; null until the browser has picked them. */
  tableSeed: string | null;
  onShuffle: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.game.setup;
  const [players, setPlayers] = useState(4);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("normal");
  const [pace, setPace] = useState<(typeof PACE_ORDER)[number]>("normal");
  const [name, setName] = useState("");

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-10">
      <form
        className="flex flex-col gap-6 lg:gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          onStart({
            players,
            difficulty,
            pace,
            playerName: name.trim().slice(0, 16) || t.defaultName,
            tableSeed: tableSeed ?? crypto.randomUUID(),
          });
        }}
      >
        <fieldset>
          <legend className="mb-2 font-bold">{t.players}</legend>
          <div className="grid grid-cols-5 gap-2">
            {PLAYER_COUNTS.map((n) => (
              <Choice
                key={n}
                selected={players === n}
                onSelect={() => setPlayers(n)}
                label={String(n)}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{format(t.playersHint, { bots: players - 1 })}</p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-bold">{t.difficulty}</legend>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTIES.map((d) => (
              <Choice
                key={d}
                selected={difficulty === d}
                onSelect={() => setDifficulty(d)}
                label={t[d]}
                hint={t[`${d}Hint`]}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-bold">{t.pace}</legend>
          <div className="grid grid-cols-3 gap-2">
            {PACE_ORDER.map((p) => (
              <Choice
                key={p}
                selected={pace === p}
                onSelect={() => setPace(p)}
                label={t[PACE_TEXT[p][0]]}
                hint={t[PACE_TEXT[p][1]]}
              />
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="font-bold">{t.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.defaultName}
            maxLength={16}
            autoComplete="nickname"
            className="min-h-12 rounded-2xl border-3 border-outline bg-panel px-4 text-lg text-ink placeholder:text-muted/60"
          />
        </label>

        <GameButton type="submit" variant="primary" className="lg:min-h-18 lg:text-2xl">
          {t.start}
        </GameButton>
        <Link
          href={`/${locale}/rules/learn`}
          className="text-center font-bold text-gold underline underline-offset-4"
        >
          {dict.rules.newHere}
        </Link>
      </form>
      <TablePreview
        players={players}
        difficulty={difficulty}
        pace={pace}
        name={name.trim().slice(0, 16) || t.defaultName}
        seed={tableSeed}
        onShuffle={onShuffle}
      />
    </div>
  );
}

/**
 * Desktop only: who will sit at the table, with the chosen difficulty and pace spelled out.
 * Always six places, so the card keeps its size as the player count changes.
 */
function TablePreview({
  players,
  difficulty,
  pace,
  name,
  seed,
  onShuffle,
}: {
  players: number;
  difficulty: (typeof DIFFICULTIES)[number];
  pace: (typeof PACE_ORDER)[number];
  name: string;
  seed: string | null;
  onShuffle: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.game.setup;
  const theme = getTheme();
  const seats = seed
    ? createLocalSeats({ players, difficulty, pace, playerName: name }, theme, locale, seed)
    : [];

  return (
    <aside
      aria-label={t.tableTitle}
      className="hidden flex-col gap-5 rounded-3xl border-3 border-outline bg-panel p-6 shadow-hard-sm lg:sticky lg:top-8 lg:flex"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-game-sm text-2xl">{t.tableTitle}</h2>
        <button
          type="button"
          onClick={onShuffle}
          className="rounded-full border-3 border-outline bg-bg px-3 py-1 text-sm font-extrabold shadow-hard-sm active:translate-y-0.5"
        >
          {t.shuffle}
        </button>
      </div>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
        {Array.from({ length: RULES.MAX_PLAYERS }, (_, i) => {
          const seat = seats[i];
          return seat ? (
            <li key={seat.id} className="flex min-w-0 flex-col items-center gap-1 text-center">
              <Avatar theme={theme} character={seat.avatar} className="size-20" />
              <span className="w-full truncate font-extrabold">{seat.name}</span>
              <span
                className={`rounded px-1.5 text-xs font-extrabold text-outline ${
                  seat.kind === "bot" ? "bg-gold" : "bg-gain"
                }`}
              >
                {seat.kind === "bot" ? dict.game.seat.bot : dict.game.seat.you}
              </span>
            </li>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: empty places are only positions
            <li key={i} className="flex flex-col items-center gap-1 text-center text-muted">
              <span className="size-20 rounded-full border-3 border-dashed border-outline" />
              <span className="text-sm">{t.emptySeat}</span>
            </li>
          );
        })}
      </ul>
      <dl className="flex flex-col gap-2 rounded-2xl bg-bg/60 p-4 text-sm">
        <div>
          <dt className="inline font-extrabold">{t.difficulty}: </dt>
          <dd className="inline">
            {t[difficulty]}, {t[`${difficulty}Hint`].toLowerCase()}
          </dd>
        </div>
        <div>
          <dt className="inline font-extrabold">{t.pace}: </dt>
          <dd className="inline">
            {t[PACE_TEXT[pace][0]]}, {t[PACE_TEXT[pace][1]].toLowerCase()}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
