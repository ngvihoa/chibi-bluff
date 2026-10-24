"use client";

// Functional (not yet styled) game table: enough to play a full game end to end.
// The polished mobile layout replaces this in checkpoint 9 (docs/ui-design.md §4).

import {
  ACTION_RULES,
  type ActionType,
  type PlayerId,
  type PlayerInput,
  type PlayerViewPlayer,
} from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CardBack } from "@/components/cards/card-back";
import { CardFace } from "@/components/cards/card-face";
import { GameButton } from "@/components/game-button";
import { type DescribeContext, describeEvent } from "@/game/describe";
import type { GameHost } from "@/game/host";
import { useGameHost, useSecondsLeft } from "@/game/use-game-host";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";

type Declare = Extract<PlayerInput, { type: "DECLARE" }>;

export function PlainTable({
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
  const { view, legal, log, seats } = useGameHost(host);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [keep, setKeep] = useState<number[]>([]);
  const secondsLeft = useSecondsLeft(view.phase.deadline);

  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const name = (id: PlayerId) =>
    id === view.viewerId ? t.seat.you : (seatById.get(id)?.name ?? id);
  const roleName = (role: keyof ThemeManifest["roles"]) => theme.roles[role].name[locale];
  const ctx: DescribeContext = { dict, theme, locale, name };
  const ability = (role: keyof ThemeManifest["roles"]) =>
    format(dict.cards.abilities[role], { currency: theme.currency[locale] });
  const labels = { lost: dict.cards.lost, owned: dict.cards.yours };

  const me = view.players.find((p) => p.id === view.viewerId);
  const opponents = view.players.filter((p) => p.id !== view.viewerId);
  const declares = legal.filter((i): i is Declare => i.type === "DECLARE");
  const targetInputs = pendingAction ? declares.filter((d) => d.action === pendingAction) : [];
  const targetIds = new Set(targetInputs.map((d) => d.targetId));
  const responses = legal.filter(
    (i) => i.type === "PASS" || i.type === "CHALLENGE" || i.type === "BLOCK",
  );

  const send = (input: PlayerInput) => {
    setPendingAction(null);
    setKeep([]);
    host.submit(input);
  };

  const status = statusLine();
  const lines = log
    .map((e) => describeEvent(e, ctx))
    .filter((l): l is string => l !== null)
    .slice(-8)
    .reverse();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      {/* Opponents */}
      <section className="grid grid-cols-3 gap-2">
        {opponents.map((p) => (
          <Seat
            key={p.id}
            player={p}
            name={name(p.id)}
            isBot={seatById.get(p.id)?.kind === "bot"}
            active={isActive(p.id)}
            targetable={targetIds.has(p.id)}
            onTarget={() => {
              const input = targetInputs.find((d) => d.targetId === p.id);
              if (input) send(input);
            }}
            theme={theme}
            locale={locale}
            text={{ bot: t.seat.bot, out: t.seat.out, back: dict.cards.back }}
            labels={labels}
          />
        ))}
      </section>

      {/* Status */}
      <section
        className="rounded-2xl border-3 border-outline bg-panel p-3 shadow-hard-sm"
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold">{status}</p>
          {secondsLeft !== null && view.phase.kind !== "AWAIT_ACTION" && (
            <span className="shrink-0 rounded-full bg-outline px-2 text-sm text-gold">
              {format(t.phase.secondsLeft, { seconds: secondsLeft })}
            </span>
          )}
        </div>
        {view.turn.action && view.phase.kind !== "AWAIT_ACTION" && (
          <p className="mt-1 text-sm text-muted">
            {describeEvent({ type: "ACTION_DECLARED", action: view.turn.action }, ctx)}
          </p>
        )}
      </section>

      {/* Responses */}
      {responses.length > 0 && (
        <section className="grid grid-cols-2 gap-2">
          {responses.map((input) => (
            <SmallButton
              key={input.type === "BLOCK" ? `block-${input.role}` : input.type}
              tone={
                input.type === "CHALLENGE" ? "danger" : input.type === "PASS" ? "neutral" : "gold"
              }
              onClick={() => send(input)}
            >
              {input.type === "CHALLENGE"
                ? t.respond.challenge
                : input.type === "PASS"
                  ? t.respond.pass
                  : input.type === "BLOCK"
                    ? format(t.respond.block, { role: roleName(input.role) })
                    : ""}
            </SmallButton>
          ))}
        </section>
      )}

      {/* My hand */}
      {me && (
        <section className="flex items-end justify-center gap-3">
          {view.phase.kind === "AWAIT_EXCHANGE" && view.phase.options ? (
            <ExchangePicker
              options={view.phase.options}
              keepCount={view.phase.keepCount}
              selected={keep}
              onToggle={(i) =>
                setKeep((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i]))
              }
              render={(role, selected) => (
                <CardFace
                  theme={theme}
                  character={role}
                  locale={locale}
                  ability={ability(role)}
                  selected={selected}
                  labels={labels}
                  className="w-24"
                />
              )}
            />
          ) : (
            cardSlots(me).map(({ key, card, index }) => {
              const lossInput = legal.find(
                (l) => l.type === "CHOOSE_LOSS" && l.cardIndex === index,
              );
              return (
                <HandCard
                  key={key}
                  onLose={lossInput ? () => send(lossInput) : undefined}
                  face={
                    card.role && (
                      <CardFace
                        theme={theme}
                        character={card.role}
                        locale={locale}
                        ability={ability(card.role)}
                        owned={!card.revealed}
                        lost={card.revealed}
                        labels={labels}
                        className="w-32"
                      />
                    )
                  }
                />
              );
            })
          )}
          <div className="flex flex-col items-center text-gold">
            <span className="text-3xl font-extrabold">{me.coins}</span>
            <span className="text-xs">{theme.currency[locale]}</span>
          </div>
        </section>
      )}

      {/* Exchange confirm */}
      {view.phase.kind === "AWAIT_EXCHANGE" && view.phase.options && (
        <SmallButton
          tone="gold"
          disabled={keep.length !== view.phase.keepCount}
          onClick={() => {
            const sorted = [...keep].sort((a, b) => a - b).join(",");
            const input = legal.find(
              (l) =>
                l.type === "CHOOSE_EXCHANGE" &&
                [...l.keep].sort((a, b) => a - b).join(",") === sorted,
            );
            if (input) send(input);
          }}
        >
          {t.phase.confirm}
        </SmallButton>
      )}

      {/* Actions */}
      {declares.length > 0 && !pendingAction && (
        <section className="grid grid-cols-2 gap-2">
          {[...new Set(declares.map((d) => d.action))].map((action) => {
            const rule = ACTION_RULES[action];
            return (
              <SmallButton
                key={action}
                tone={rule.claim ? "gold" : "neutral"}
                onClick={() => {
                  const first = declares.find((d) => d.action === action);
                  if (rule.targeted) setPendingAction(action);
                  else if (first) send(first);
                }}
              >
                <span className="flex flex-col leading-tight">
                  <span>
                    {t.actions[action]}
                    {rule.cost > 0 && ` −${rule.cost}`}
                  </span>
                  {rule.claim && (
                    <span className="text-xs font-bold opacity-80">{roleName(rule.claim)}</span>
                  )}
                </span>
              </SmallButton>
            );
          })}
        </section>
      )}
      {pendingAction && (
        <SmallButton tone="neutral" onClick={() => setPendingAction(null)}>
          {t.phase.cancel}
        </SmallButton>
      )}

      {/* Log */}
      <section className="mt-auto rounded-2xl bg-panel/60 p-3 text-sm">
        <h2 className="mb-1 font-bold text-muted">{t.log.title}</h2>
        <ol className="flex flex-col gap-0.5">
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: log lines are append-only text
            <li key={`${log.length}-${i}`} className={i === 0 ? "text-ink" : "text-muted"}>
              {line}
            </li>
          ))}
        </ol>
      </section>

      {/* Game over */}
      {view.phase.kind === "GAME_OVER" && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-outline/80 p-6">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border-3 border-outline bg-panel p-6 text-center shadow-hard">
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
    </div>
  );

  function isActive(id: PlayerId): boolean {
    const { phase } = view;
    if (phase.kind === "AWAIT_INFLUENCE_LOSS" || phase.kind === "AWAIT_EXCHANGE")
      return phase.playerId === id;
    if (phase.kind === "AWAIT_BLOCK_RESPONSE") return view.turn.block?.blockerId === id;
    return view.turn.actorId === id;
  }

  function statusLine(): string {
    const { phase } = view;
    switch (phase.kind) {
      case "AWAIT_ACTION":
        if (pendingAction) return format(t.phase.pickTarget, { action: t.actions[pendingAction] });
        return view.turn.actorId === view.viewerId
          ? t.phase.yourTurn
          : format(t.phase.theirTurn, { player: name(view.turn.actorId) });
      case "AWAIT_ACTION_RESPONSE":
        return t.phase.respond;
      case "AWAIT_BLOCK_RESPONSE":
        return view.turn.block
          ? format(t.phase.blockRespond, {
              blocker: name(view.turn.block.blockerId),
              role: roleName(view.turn.block.role),
            })
          : t.phase.respond;
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
}

interface SeatProps {
  player: PlayerViewPlayer;
  name: string;
  isBot: boolean;
  active: boolean;
  targetable: boolean;
  onTarget: () => void;
  theme: ThemeManifest;
  locale: ThemeLocale;
  text: { bot: string; out: string; back: string };
  labels: { lost: string; owned: string };
}

function Seat({
  player,
  name,
  isBot,
  active,
  targetable,
  onTarget,
  theme,
  locale,
  text,
  labels,
}: SeatProps) {
  const body = (
    <>
      <div className="flex justify-center gap-1">
        {cardSlots(player).map(({ key, card }) =>
          card.revealed ? (
            <CardFace
              key={key}
              theme={theme}
              character={card.role}
              locale={locale}
              ability=""
              compact
              lost
              labels={labels}
              className="w-9"
            />
          ) : (
            <CardBack
              key={key}
              theme={theme}
              locale={locale}
              label={text.back}
              compact
              className="w-9"
            />
          ),
        )}
      </div>
      <p className="mt-1 truncate text-sm font-bold">{name}</p>
      <p className="flex items-center justify-center gap-1 text-xs">
        {isBot && (
          <span className="rounded bg-gold px-1 font-extrabold text-outline">{text.bot}</span>
        )}
        {player.eliminated ? (
          <span className="text-muted">{text.out}</span>
        ) : (
          <span className="font-bold text-gold">
            {player.coins} {theme.currency[locale]}
          </span>
        )}
      </p>
    </>
  );
  const base = `rounded-2xl border-3 bg-panel p-2 text-center ${
    active ? "border-gold shadow-[0_0_12px_#ffd23f]" : "border-outline"
  } ${player.eliminated ? "opacity-50" : ""}`;
  return targetable ? (
    <button type="button" onClick={onTarget} className={`${base} animate-pulse ring-4 ring-danger`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

function HandCard({ face, onLose }: { face: React.ReactNode; onLose?: () => void }) {
  if (!onLose) return <div>{face}</div>;
  return (
    <button
      type="button"
      onClick={onLose}
      className="rounded-[28px] ring-4 ring-danger transition hover:-translate-y-1"
    >
      {face}
    </button>
  );
}

/** A player's two card slots with stable keys (slots never reorder). */
function cardSlots(player: PlayerViewPlayer) {
  return player.cards.map((card, index) => ({ key: `${player.id}:${index}`, card, index }));
}

function ExchangePicker({
  options,
  keepCount,
  selected,
  onToggle,
  render,
}: {
  options: (keyof ThemeManifest["roles"])[];
  keepCount: number;
  selected: number[];
  onToggle: (index: number) => void;
  render: (role: keyof ThemeManifest["roles"], selected: boolean) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((role, i) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: option slots are fixed for this exchange
          key={i}
          type="button"
          aria-pressed={selected.includes(i)}
          disabled={!selected.includes(i) && selected.length >= keepCount}
          onClick={() => onToggle(i)}
          className="disabled:opacity-50"
        >
          {render(role, selected.includes(i))}
        </button>
      ))}
    </div>
  );
}

function SmallButton({
  tone,
  children,
  ...rest
}: { tone: "danger" | "gold" | "neutral" } & React.ComponentProps<"button">) {
  const tones = {
    danger: "bg-linear-to-b from-[#ff6b5a] to-danger text-game-sm",
    gold: "bg-linear-to-b from-[#ffe27a] to-gold text-outline",
    neutral: "bg-linear-to-b from-[#a99cc4] to-[#7d6f9c] text-game-sm",
  };
  return (
    <button
      type="button"
      className={`min-h-12 rounded-2xl border-3 border-outline px-3 py-1 font-extrabold shadow-hard-sm transition active:translate-y-0.5 disabled:opacity-50 ${tones[tone]}`}
      {...rest}
    >
      {children}
    </button>
  );
}
