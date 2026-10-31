"use client";

import {
  ACTION_TIMEOUT_OPTIONS,
  BOT_DIFFICULTY_OPTIONS,
  MAX_SEATS,
  MIN_SEATS_TO_START,
  PACE_OPTIONS,
  type RoomSettings,
  type RoomView,
  type SeatView,
} from "@chibi-bluff/protocol";
import type { ThemeManifest } from "@chibi-bluff/themes";
import { type ReactNode, useState } from "react";
import { Choice } from "@/components/choice";
import { GameButton } from "@/components/game-button";
import { Avatar } from "@/components/table/avatar";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import type { RoomClient } from "@/online/room-client";
import { useErrorText } from "./error-text";

const PACE_TEXT = {
  relaxed: ["relaxed", "relaxedHint"],
  normal: ["normalPace", "normalPaceHint"],
  fast: ["fast", "fastHint"],
} as const;

/** Waiting room: invite, seats, settings, start (docs/architecture.md §5.1). */
export function Lobby({
  room,
  client,
  theme,
  onLeave,
}: {
  room: RoomView;
  client: RoomClient;
  theme: ThemeManifest;
  onLeave: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.online.lobby;
  const setup = dict.game.setup;
  const errorText = useErrorText();
  const [notice, setNotice] = useState<string | null>(null);
  const isHost = room.hostId === room.you;
  const full = room.seats.length >= MAX_SEATS;

  /** Runs a lobby action and shows its error, if any. */
  const run = async (action: () => Promise<string | null>) => {
    const error = await action();
    setNotice(error ? errorText(error) : null);
  };
  const change = (settings: Partial<RoomSettings>) => run(() => client.updateSettings(settings));

  const invite = async () => {
    const url = `${window.location.origin}/room/${room.code}`;
    const text = format(t.inviteText, { code: room.code });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Chibi Bluff", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice(t.copied);
    } catch {
      // The share sheet was closed, or the clipboard is blocked: nothing to do.
    }
  };

  const timerLabel = (seconds: number) =>
    seconds === 0 ? t.off : seconds === 120 ? t.twoMinutes : format(t.seconds, { n: seconds });

  return (
    // Desktop (docs/ui-design.md §4.2b): seats and settings on the left; the code and the start
    // button stay in view on the right.
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:grid lg:max-w-[1120px] lg:grid-cols-[minmax(0,1fr)_360px] lg:content-start lg:items-start lg:gap-x-10 lg:gap-y-6 lg:px-8 lg:pt-8">
      <div className="flex items-center gap-3 lg:col-span-2">
        <button
          type="button"
          onClick={() => window.confirm(t.leaveConfirm) && onLeave()}
          className="font-bold text-gold underline underline-offset-4"
        >
          {t.leave}
        </button>
        <h1 className="text-game flex-1 text-right text-2xl lg:text-4xl">{dict.online.title}</h1>
      </div>

      {/* Right column on desktop; on phones its parts fall back into the page's own order. */}
      <div className="contents lg:sticky lg:top-6 lg:col-start-2 lg:row-start-2 lg:flex lg:flex-col lg:gap-5">
        {/* Invite */}
        <section className="flex flex-col items-center gap-3 rounded-3xl border-3 border-outline bg-panel p-4 shadow-hard-sm">
          <p className="text-sm font-bold text-muted">{t.code}</p>
          {/* Letters spelled out for screen readers, which would read the code as a word. */}
          <p className="text-game font-mono text-5xl tracking-[0.25em] lg:text-6xl">
            <span aria-hidden>{room.code}</span>
            <span className="sr-only">{[...room.code].join(" ")}</span>
          </p>
          <GameButton variant="gold" onClick={invite}>
            {t.share}
          </GameButton>
        </section>
        <div className="order-last mt-auto flex flex-col gap-2 lg:order-none lg:mt-0">
          {notice && (
            <p role="status" className="text-center font-bold text-gold">
              {notice}
            </p>
          )}
          {isHost ? (
            <GameButton
              variant="primary"
              disabled={room.seats.length < MIN_SEATS_TO_START}
              onClick={() => run(client.startGame)}
            >
              {t.start}
            </GameButton>
          ) : (
            <p className="text-game-sm text-center text-lg">{t.waitHost}</p>
          )}
        </div>
      </div>

      <div className="contents lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col lg:gap-6">
        {/* Seats */}
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">{format(t.seats, { count: room.seats.length })}</h2>
          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
            {room.seats.map((raw) => {
              // Bots are named in each viewer's own language.
              const seat =
                raw.kind === "bot"
                  ? { ...raw, name: theme.roles[raw.avatar].botName[locale] }
                  : raw;
              return (
                <SeatRow
                  key={seat.id}
                  seat={seat}
                  theme={theme}
                  tags={[
                    seat.id === room.hostId && t.host,
                    seat.id === room.you && t.you,
                    seat.kind === "bot" && t.bot,
                    !seat.connected && t.offline,
                  ]}
                  action={
                    !isHost || seat.id === room.you
                      ? null
                      : {
                          label: format(seat.kind === "bot" ? t.removeBot : t.kick, {
                            name: seat.name,
                          }),
                          onClick: () =>
                            seat.kind === "bot"
                              ? run(() => client.removeBot(seat.id))
                              : window.confirm(format(t.kickConfirm, { name: seat.name })) &&
                                run(() => client.kick(seat.id)),
                        }
                  }
                />
              );
            })}
          </ul>
          {isHost && !full && (
            <GameButton variant="neutral" onClick={() => run(client.addBot)}>
              + {t.addBot}
            </GameButton>
          )}
        </section>

        {/* Settings */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-bold">{t.settings}</h2>
            {!isHost && <p className="text-sm text-muted">{t.hostOnly}</p>}
          </div>
          <Setting legend={setup.pace} columns={3}>
            {PACE_OPTIONS.map((pace) => (
              <Choice
                key={pace}
                selected={room.settings.pace === pace}
                disabled={!isHost}
                onSelect={() => change({ pace })}
                label={setup[PACE_TEXT[pace][0]]}
                hint={setup[PACE_TEXT[pace][1]]}
              />
            ))}
          </Setting>
          <Setting legend={t.actionTimer} columns={4}>
            {ACTION_TIMEOUT_OPTIONS.map((seconds) => (
              <Choice
                key={seconds}
                selected={room.settings.actionTimeoutSeconds === seconds}
                disabled={!isHost}
                onSelect={() => change({ actionTimeoutSeconds: seconds })}
                label={timerLabel(seconds)}
              />
            ))}
          </Setting>
          <Setting legend={setup.difficulty} columns={2}>
            {BOT_DIFFICULTY_OPTIONS.map((difficulty) => (
              <Choice
                key={difficulty}
                selected={room.settings.botDifficulty === difficulty}
                disabled={!isHost}
                onSelect={() => change({ botDifficulty: difficulty })}
                label={setup[difficulty]}
                hint={setup[`${difficulty}Hint`]}
              />
            ))}
          </Setting>
        </section>
      </div>
    </main>
  );
}

function Setting({
  legend,
  columns,
  children,
}: {
  legend: string;
  columns: number;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-muted">{legend}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {children}
      </div>
    </fieldset>
  );
}

function SeatRow({
  seat,
  theme,
  tags,
  action,
}: {
  seat: SeatView;
  theme: ThemeManifest;
  tags: (string | false)[];
  action: { label: string; onClick: () => void } | null;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border-3 border-outline bg-panel px-3 py-2 ${
        seat.connected ? "" : "opacity-60"
      }`}
    >
      <Avatar theme={theme} character={seat.avatar} className="size-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-extrabold">{seat.name}</p>
        <p className="flex flex-wrap gap-1">
          {tags.filter(Boolean).map((tag) => (
            <span
              key={tag as string}
              className="rounded-md border-2 border-outline bg-gold px-1.5 text-[11px] font-extrabold text-outline"
            >
              {tag}
            </span>
          ))}
        </p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          title={action.label}
          className="grid size-9 place-items-center rounded-full border-3 border-outline bg-danger text-lg font-extrabold shadow-hard-sm active:translate-y-0.5"
        >
          ×
        </button>
      )}
    </li>
  );
}
