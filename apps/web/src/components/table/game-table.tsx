"use client";

// Mobile-first game table (docs/ui-design.md §4.1). Works with any GameHost.

import type { PlayerId, PlayerInput, Role } from "@chibi-bluff/engine";
import type { ThemeManifest } from "@chibi-bluff/themes";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardFace } from "@/components/cards/card-face";
import { GameButton } from "@/components/game-button";
import { type DescribeContext, describeEvent } from "@/game/describe";
import type { GameHost } from "@/game/host";
import {
  type ActionButton,
  actionButtons,
  activeSeat,
  cardSlots,
  stageClaim,
} from "@/game/table-model";
import { useGameHost } from "@/game/use-game-host";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { ActionBar } from "./action-bar";
import { BottomSheet } from "./bottom-sheet";
import { LeaveIcon, ScrollIcon } from "./icons";
import { Incense } from "./incense";
import { LogSheet } from "./log-sheet";
import { Coins, OpponentSeat } from "./opponent-seat";
import { Stage } from "./stage";

export function GameTable({
  host,
  theme,
  onNewGame,
}: {
  host: GameHost;
  theme: ThemeManifest;
  onNewGame: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.game;
  const { view, legal, log, latest, seats } = useGameHost(host);
  const [targeting, setTargeting] = useState<ActionButton | null>(null);
  const [keep, setKeep] = useState<number[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const toast = useToast();

  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const name = (id: PlayerId) =>
    id === view.viewerId ? t.seat.you : (seatById.get(id)?.name ?? id);
  const roleName = (role: Role) => theme.roles[role].name[locale];
  const ability = (role: Role) =>
    format(dict.cards.abilities[role], { currency: theme.currency[locale] });
  const labels = { lost: dict.cards.lost, owned: dict.cards.yours };
  const ctx: DescribeContext = { dict, theme, locale, name };

  const me = view.players.find((p) => p.id === view.viewerId);
  const opponents = view.players.filter((p) => p.id !== view.viewerId);
  const buttons = actionButtons(view, legal);
  const responses = legal.filter(
    (i) => i.type === "PASS" || i.type === "CHALLENGE" || i.type === "BLOCK",
  );
  const losing = legal.some((i) => i.type === "CHOOSE_LOSS");
  const exchanging = view.phase.kind === "AWAIT_EXCHANGE" && view.phase.options !== null;
  const claim = stageClaim(view);
  const active = activeSeat(view);
  const myTurn = view.phase.kind === "AWAIT_ACTION" && view.turn.actorId === view.viewerId;

  // Drop a half-finished target pick or exchange selection once the phase moves on.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the phase changes
  useEffect(() => {
    setTargeting(null);
    setKeep([]);
  }, [view.phaseId]);

  useHaptics(view.phaseId, myTurn, latest);

  const send = (input: PlayerInput) => {
    setTargeting(null);
    setKeep([]);
    host.submit({ ...input, phaseId: view.phaseId });
  };

  const pick = (button: ActionButton) => {
    const [only] = button.inputs;
    if (!button.targeted && only) send(only);
    else setTargeting(button);
  };

  const lines = log.map((e) => describeEvent(e, ctx)).filter((l): l is string => l !== null);
  const timer =
    view.phase.deadline !== null && view.phase.kind !== "AWAIT_ACTION" ? (
      <Incense
        deadline={view.phase.deadline}
        phaseId={view.phaseId}
        label={t.phase.secondsLeft.replace(
          "{seconds}",
          String(Math.ceil((view.phase.deadline - Date.now()) / 1000)),
        )}
        className="h-16 w-6 shrink-0"
      />
    ) : null;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link
          href={`/${locale}`}
          onClick={(e) => {
            if (view.phase.kind !== "GAME_OVER" && !window.confirm(t.table.leaveConfirm))
              e.preventDefault();
          }}
          aria-label={t.table.leave}
          className="rounded-full border-3 border-outline bg-panel p-1 shadow-hard-sm"
        >
          <LeaveIcon className="size-7" />
        </Link>
        <p className="flex-1 truncate text-center text-sm font-extrabold">
          {format(t.table.turnLabel, { turn: view.turnNumber })} · {name(view.turn.actorId)}
        </p>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          aria-label={t.table.log}
          className="rounded-full border-3 border-outline bg-panel p-1 shadow-hard-sm"
        >
          <ScrollIcon className="size-7" />
        </button>
      </header>

      {/* Opponents */}
      <section
        className="grid gap-2 px-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(3, opponents.length)}, minmax(0, 1fr))` }}
      >
        {opponents.map((p) => {
          const seat = seatById.get(p.id);
          if (!seat) return null;
          const input = targeting?.inputs.find((i) => i.targetId === p.id);
          return (
            <OpponentSeat
              key={p.id}
              player={p}
              seat={seat}
              theme={theme}
              locale={locale}
              active={active === p.id}
              onTarget={input ? () => send(input) : undefined}
              text={{ bot: t.seat.bot, out: t.seat.out, back: dict.cards.back, ...labels }}
            />
          );
        })}
      </section>

      {/* Stage */}
      <div className="px-3 pt-3">
        <Stage
          view={view}
          claim={claim}
          headline={headline()}
          detail={detail()}
          theme={theme}
          locale={locale}
          dict={dict}
          name={name}
        />
      </div>

      {/* My hand */}
      {me && (
        <section className="flex min-h-0 flex-1 items-center justify-center gap-3 px-3 py-2 [container-type:size]">
          {cardSlots(me).map(({ key, card, index }) =>
            card.role ? (
              <CardFace
                key={key}
                theme={theme}
                character={card.role}
                locale={locale}
                ability={ability(card.role)}
                owned={!card.revealed}
                lost={card.revealed}
                labels={labels}
                className={`h-[88cqh] max-w-[36cqw] ${index === 0 ? "-rotate-3" : "rotate-3"}`}
              />
            ) : null,
          )}
          <div className="flex flex-col items-center">
            <Coins theme={theme} amount={me.coins} className="text-3xl" />
            <span className="text-xs text-muted">{theme.currency[locale]}</span>
          </div>
        </section>
      )}

      {/* Bottom: one of the sheets, or the action bar */}
      <div className="relative">
        {toast.message && (
          <p
            role="status"
            className="absolute inset-x-6 -top-12 z-10 rounded-2xl border-3 border-outline bg-gold px-3 py-1.5 text-center text-sm font-extrabold text-outline shadow-hard-sm"
          >
            {toast.message}
          </p>
        )}
        {responses.length > 0 ? (
          <BottomSheet title={responseTitle()} aside={timer}>
            <div className="grid grid-cols-2 gap-2">
              {[...responses]
                .sort((a, b) => RESPONSE_ORDER[a.type] - RESPONSE_ORDER[b.type])
                .map(responseButton)}
            </div>
          </BottomSheet>
        ) : losing ? (
          <BottomSheet title={t.phase.loseYou} aside={timer}>
            <div className="flex justify-center gap-4">
              {me &&
                cardSlots(me).map(({ key, card, index }) => {
                  const input = legal.find(
                    (l) => l.type === "CHOOSE_LOSS" && l.cardIndex === index,
                  );
                  if (!input || !card.role) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => send(input)}
                      className="rounded-[28px] transition active:scale-95"
                    >
                      <CardFace
                        theme={theme}
                        character={card.role}
                        locale={locale}
                        ability={ability(card.role)}
                        labels={labels}
                        className="w-28"
                      />
                    </button>
                  );
                })}
            </div>
          </BottomSheet>
        ) : exchanging && view.phase.kind === "AWAIT_EXCHANGE" && view.phase.options ? (
          <BottomSheet
            title={format(t.phase.exchangeYou, { count: view.phase.keepCount })}
            aside={timer}
          >
            <div className="grid grid-cols-4 gap-2">
              {view.phase.options.map((role, index) => {
                const selected = keep.includes(index);
                const full =
                  keep.length >= (view.phase.kind === "AWAIT_EXCHANGE" ? view.phase.keepCount : 0);
                return (
                  <button
                    // biome-ignore lint/suspicious/noArrayIndexKey: option slots are fixed for this exchange
                    key={index}
                    type="button"
                    aria-pressed={selected}
                    disabled={!selected && full}
                    onClick={() =>
                      setKeep((k) => (selected ? k.filter((x) => x !== index) : [...k, index]))
                    }
                    className="disabled:opacity-40"
                  >
                    <CardFace
                      theme={theme}
                      character={role}
                      locale={locale}
                      ability={ability(role)}
                      selected={selected}
                      labels={labels}
                    />
                  </button>
                );
              })}
            </div>
            <GameButton
              variant="gold"
              className="mt-3"
              disabled={keep.length !== view.phase.keepCount}
              onClick={() => {
                const wanted = [...keep].sort((a, b) => a - b).join(",");
                const input = legal.find(
                  (l) =>
                    l.type === "CHOOSE_EXCHANGE" &&
                    [...l.keep].sort((a, b) => a - b).join(",") === wanted,
                );
                if (input) send(input);
              }}
            >
              {t.phase.confirm}
            </GameButton>
          </BottomSheet>
        ) : me?.eliminated && view.phase.kind !== "GAME_OVER" && !watching ? (
          <BottomSheet title={t.table.youAreOut}>
            <div className="grid grid-cols-2 gap-2">
              <GameButton variant="primary" onClick={onNewGame}>
                {t.over.again}
              </GameButton>
              <GameButton variant="neutral" onClick={() => setWatching(true)}>
                {t.table.keepWatching}
              </GameButton>
            </div>
          </BottomSheet>
        ) : targeting ? (
          <BottomSheet title={format(t.phase.pickTarget, { action: t.actions[targeting.action] })}>
            <GameButton variant="neutral" onClick={() => setTargeting(null)}>
              {t.phase.cancel}
            </GameButton>
          </BottomSheet>
        ) : (
          <ActionBar
            buttons={buttons}
            theme={theme}
            locale={locale}
            dict={dict}
            onPick={pick}
            onExplain={toast.show}
          />
        )}
      </div>

      <LogSheet
        open={logOpen}
        lines={lines}
        title={t.table.log}
        closeLabel={t.table.close}
        onClose={() => setLogOpen(false)}
      />

      {view.phase.kind === "GAME_OVER" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-outline/80 p-6">
          <div className="flex w-full max-w-sm animate-[pop-in_400ms_cubic-bezier(.3,1.6,.6,1)] flex-col gap-4 rounded-3xl border-3 border-outline bg-panel p-6 text-center shadow-hard">
            <p className="text-game text-3xl">
              {view.phase.winnerId === view.viewerId
                ? t.over.youWon
                : format(t.over.theyWon, { player: name(view.phase.winnerId) })}
            </p>
            <GameButton variant="primary" onClick={onNewGame}>
              {t.over.again}
            </GameButton>
            <Link href={`/${locale}`} className="font-bold text-gold underline underline-offset-4">
              {t.over.home}
            </Link>
          </div>
        </div>
      )}

      {/* Landscape phones (docs/ui-design.md §4.1) */}
      <div className="fixed inset-0 z-30 hidden items-center justify-center bg-bg p-6 text-center [@media(orientation:landscape)_and_(max-height:500px)]:flex">
        <p className="text-game text-2xl">{t.table.rotate}</p>
      </div>
    </div>
  );

  function headline(): string {
    const { phase } = view;
    switch (phase.kind) {
      case "AWAIT_ACTION":
        return myTurn
          ? t.phase.yourTurn
          : format(t.phase.theirTurn, { player: name(view.turn.actorId) });
      case "AWAIT_ACTION_RESPONSE":
      case "AWAIT_BLOCK_RESPONSE": {
        const { action } = view.turn;
        if (!action) return "";
        // With a character on stage, a short "Steal: A → B" is enough; otherwise the full sentence.
        if (!claim) return describeEvent({ type: "ACTION_DECLARED", action }, ctx) ?? "";
        const target = action.targetId ? ` → ${name(action.targetId)}` : "";
        return `${t.actions[action.type]}: ${name(action.actorId)}${target}`;
      }
      case "AWAIT_INFLUENCE_LOSS":
        return phase.playerId === view.viewerId
          ? t.phase.loseYou
          : format(t.phase.loseThem, { player: name(phase.playerId) });
      case "AWAIT_EXCHANGE":
        return phase.playerId === view.viewerId
          ? format(t.phase.exchangeYou, { count: phase.keepCount })
          : format(t.phase.exchangeThem, { player: name(phase.playerId) });
      case "GAME_OVER":
        return format(t.over.theyWon, { player: name(phase.winnerId) });
    }
  }

  /** Latest log line, unless it just repeats the action already on stage. */
  function detail(): string | null {
    const last = lines.at(-1) ?? null;
    const current = view.turn.action
      ? describeEvent({ type: "ACTION_DECLARED", action: view.turn.action }, ctx)
      : null;
    return last === current && view.phase.kind !== "AWAIT_ACTION" ? null : last;
  }

  function responseTitle(): string {
    if (view.phase.kind === "AWAIT_BLOCK_RESPONSE" && view.turn.block) {
      return format(t.phase.blockRespond, {
        blocker: name(view.turn.block.blockerId),
        role: roleName(view.turn.block.role),
      });
    }
    return t.phase.respond;
  }

  function responseButton(input: PlayerInput) {
    if (input.type === "CHALLENGE") {
      return (
        <GameButton key="challenge" variant="primary" onClick={() => send(input)}>
          {t.respond.challenge}
        </GameButton>
      );
    }
    if (input.type === "BLOCK") {
      return (
        <button
          key={`block-${input.role}`}
          type="button"
          onClick={() => send(input)}
          className="text-game-sm flex min-h-14 items-center justify-center gap-2 rounded-2xl border-3 border-outline px-2 font-extrabold shadow-hard transition active:translate-y-1"
          style={{ background: theme.roles[input.role].color }}
        >
          {format(t.respond.block, { role: roleName(input.role) })}
        </button>
      );
    }
    return (
      <GameButton key="pass" variant="neutral" onClick={() => send(input)}>
        {t.respond.pass}
      </GameButton>
    );
  }
}

/** Challenge and pass side by side, blocks below. */
const RESPONSE_ORDER: Record<PlayerInput["type"], number> = {
  CHALLENGE: 0,
  PASS: 1,
  BLOCK: 2,
  DECLARE: 3,
  CHOOSE_LOSS: 3,
  CHOOSE_EXCHANGE: 3,
};

/** Short-lived message above the action bar. */
function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return {
    message,
    show: (text: string) => {
      setMessage(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), 2200);
    },
  };
}

/** Vibrate (where supported) when it becomes your turn and when a challenge is resolved. */
function useHaptics(phaseId: number, myTurn: boolean, latest: { type: string }[]) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per phase
  useEffect(() => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (latest.some((e) => e.type === "CHALLENGE_RESOLVED")) navigator.vibrate([40, 60, 40]);
    else if (myTurn) navigator.vibrate(30);
  }, [phaseId]);
}
