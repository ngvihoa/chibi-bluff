"use client";

import { RULES } from "@chibi-bluff/engine";
import { useState } from "react";
import { GameButton } from "@/components/game-button";
import type { LocalSetup } from "@/game/seats";
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

export function SetupForm({ onStart }: { onStart: (setup: LocalSetup) => void }) {
  const { dict } = useI18n();
  const t = dict.game.setup;
  const [players, setPlayers] = useState(4);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("normal");
  const [pace, setPace] = useState<(typeof PACE_ORDER)[number]>("normal");
  const [name, setName] = useState("");

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onStart({
          players,
          difficulty,
          pace,
          playerName: name.trim().slice(0, 16) || t.defaultName,
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

      <GameButton type="submit" variant="primary">
        {t.start}
      </GameButton>
    </form>
  );
}

function Choice({
  selected,
  onSelect,
  label,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="flex min-h-12 flex-col items-center justify-center rounded-2xl border-3 border-outline bg-panel px-2 py-1 font-extrabold text-muted shadow-hard-sm transition active:translate-y-0.5 aria-pressed:bg-gold aria-pressed:text-outline"
    >
      <span className="text-lg">{label}</span>
      {hint && <span className="text-center text-xs font-medium leading-tight">{hint}</span>}
    </button>
  );
}
