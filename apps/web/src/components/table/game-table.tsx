"use client";

// Mobile-first game table (docs/ui-design.md §4.1). Works with any GameHost.

import type { PlayerId, PlayerInput, Role } from "@chibi-bluff/engine";
import type { ThemeManifest } from "@chibi-bluff/themes";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardFace } from "@/components/cards/card-face";
import { EmptySlot } from "@/components/cards/empty-slot";
import { GameButton } from "@/components/game-button";
import { type DescribeContext, describeEvent } from "@/game/describe";
import type { GameHost } from "@/game/host";
import {
  type ActionButton,
  actionButtons,
  activeSeat,
  cardSlots,
  deckCount,
  returningSlot,
  revealedCounts,
  stageClaim,
} from "@/game/table-model";
import { useGameHost, useSecondsLeft } from "@/game/use-game-host";
import { useMoments } from "@/game/use-moments";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { ActionBar } from "./action-bar";
import { Avatar } from "./avatar";
import { BottomSheet } from "./bottom-sheet";
import { DeckPile } from "./deck-pile";
import { FlyLayer } from "./fly-layer";
import { LeaveIcon, ScrollIcon, TallyIcon } from "./icons";
import { Incense } from "./incense";
import { LogSheet } from "./log-sheet";
import { CoinFloats, Confetti, MomentOverlay } from "./moments";
import { Coins, OpponentSeat } from "./opponent-seat";
import { ReplacementPicker } from "./replacement-picker";
import { RevealedTally } from "./revealed-tally";
import { Stage } from "./stage";
import { StickerBubble, StickerPicker, useStickers } from "./stickers";

export function GameTable({
  host,
  theme,
  onNewGame,
  againLabel,
  leaveConfirm,
}: {
  host: GameHost;
  theme: ThemeManifest;
  onNewGame: () => void;
  /** Label of the "play again" button (online: a new room). */
  againLabel?: string;
  /** Question asked before leaving mid-game. */
  leaveConfirm?: string;
}) {
  const { locale, dict } = useI18n();
  const t = dict.game;
  const { view, legal, log, latest, seats } = useGameHost(host);
  const [targeting, setTargeting] = useState<ActionButton | null>(null);
  const [keep, setKeep] = useState<number[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const stickers = useStickers(host.stickers, view.viewerId);
  const [stickerOpen, setStickerOpen] = useState(false);
  const toast = useToast();
  const moments = useMoments(latest, view.viewerId);
  const [showTally, setShowTally] = useTallyPreference();
  const replacing = legal.some((i) => i.type === "CHOOSE_REPLACEMENT");
  const secondsLeft = useSecondsLeft(view.phase.deadline);
  // The full-screen pick (R-DG-8) stays open past the engine's phase, through the reveal.
  const [picker, setPicker] = useState<{ choices: number; slot: number } | null>(null);

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
    setStickerOpen(false);
  }, [view.phaseId]);

  // Open the pick once the challenge overlay has played.
  const pickReady = replacing && !moments.current;
  // biome-ignore lint/correctness/useExhaustiveDependencies: opens once per replacement phase
  useEffect(() => {
    if (!pickReady || view.phase.kind !== "AWAIT_REPLACEMENT") return;
    const { choices, playerId } = view.phase;
    setPicker((p) => p ?? { choices, slot: returningSlot(view, playerId) ?? 0 });
  }, [pickReady, view.phaseId]);

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
      <div className="flex shrink-0 items-end gap-1">
        <span
          className={`font-extrabold tabular-nums ${secondsLeft !== null && secondsLeft <= 3 ? "text-danger" : "text-gold"}`}
        >
          {secondsLeft}s
        </span>
        <Incense
          deadline={view.phase.deadline}
          phaseId={view.phaseId}
          label={format(t.phase.secondsLeft, { seconds: secondsLeft ?? 0 })}
          className="h-16 w-6"
        />
      </div>
    ) : null;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link
          href={`/${locale}`}
          onClick={(e) => {
            if (
              view.phase.kind !== "GAME_OVER" &&
              !window.confirm(leaveConfirm ?? t.table.leaveConfirm)
            )
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
          onClick={() => setShowTally(!showTally)}
          aria-label={showTally ? t.table.tallyHide : t.table.tallyShow}
          aria-pressed={showTally}
          className="rounded-full border-3 border-outline bg-panel p-1 shadow-hard-sm aria-pressed:bg-gold"
        >
          <TallyIcon className="size-7" />
        </button>
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
              text={{
                bot: t.seat.bot,
                out: t.seat.out,
                back: dict.cards.back,
                awaiting: t.table.awaitingCard,
                offline: t.seat.offline,
                standIn: t.seat.standIn,
                ...labels,
              }}
              floats={moments.floats}
              emptySlot={returningSlot(view, p.id)}
              sticker={stickers.shown.get(p.id)?.sticker}
            />
          );
        })}
      </section>

      {showTally && (
        <RevealedTally
          counts={revealedCounts(view)}
          theme={theme}
          locale={locale}
          label={t.table.tally}
        />
      )}

      {/* Stage, with the court deck beside it */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <Stage
            view={view}
            claim={claim}
            headline={headline()}
            detail={detail()}
            recap={recapLines()}
            theme={theme}
            locale={locale}
            dict={dict}
            name={name}
          />
        </div>
        <DeckPile
          theme={theme}
          locale={locale}
          count={deckCount(view)}
          label={format(t.table.deck, { count: deckCount(view) })}
        />
      </div>

      {/* My hand */}
      {me && (
        <section
          data-seat={me.id}
          className="flex min-h-0 flex-1 items-center justify-center gap-3 px-3 py-2 [container-type:size]"
        >
          {cardSlots(me).map(({ key, card, index }) =>
            index === returningSlot(view, me.id) || index === picker?.slot ? (
              <EmptySlot
                key={`${key}:empty`}
                slot={index}
                label={t.table.awaitingCard}
                className={`h-[88cqh] max-w-[36cqw] ${index === 0 ? "-rotate-3" : "rotate-3"}`}
              />
            ) : card.role ? (
              <CardFace
                // Remount when lost so the flip plays; the first mount plays the deal.
                key={`${key}:${card.revealed}`}
                theme={theme}
                character={card.role}
                locale={locale}
                ability={ability(card.role)}
                owned={!card.revealed}
                lost={card.revealed}
                labels={labels}
                className={`h-[88cqh] max-w-[36cqw] ${index === 0 ? "-rotate-3" : "rotate-3"} ${
                  card.revealed
                    ? "animate-[flip-in_500ms_ease-out]"
                    : index === 0
                      ? "animate-[deal_500ms_cubic-bezier(.3,1.4,.6,1)_both]"
                      : "animate-[deal_500ms_cubic-bezier(.3,1.4,.6,1)_120ms_both]"
                }`}
              />
            ) : null,
          )}
          <div className="relative flex flex-col items-center">
            <CoinFloats floats={moments.floats} playerId={me.id} />
            {stickers.shown.get(me.id) && (
              <StickerBubble
                sticker={(stickers.shown.get(me.id) as { sticker: Role }).sticker}
                theme={theme}
                locale={locale}
                className="right-0 -top-12"
              />
            )}
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
                {againLabel ?? t.over.again}
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
        ) : stickerOpen ? (
          <BottomSheet
            title={t.table.stickerTitle}
            aside={
              <button
                type="button"
                onClick={() => setStickerOpen(false)}
                className="font-bold text-gold underline underline-offset-4"
              >
                {t.table.close}
              </button>
            }
          >
            <StickerPicker
              theme={theme}
              locale={locale}
              coolingDown={stickers.coolingDown}
              muted={stickers.muted}
              muteLabel={t.table.stickerMute}
              onMute={stickers.setMuted}
              onSend={(sticker) => {
                stickers.send(sticker);
                setStickerOpen(false);
              }}
            />
          </BottomSheet>
        ) : (
          <ActionBar
            buttons={buttons}
            theme={theme}
            locale={locale}
            dict={dict}
            onPick={pick}
            onExplain={toast.show}
            onSticker={stickers.available ? () => setStickerOpen(true) : undefined}
          />
        )}
      </div>

      <FlyLayer latest={latest} viewerId={view.viewerId} theme={theme} locale={locale} />

      {picker && me && (
        <ReplacementPicker
          theme={theme}
          locale={locale}
          viewerId={me.id}
          choices={picker.choices}
          slot={picker.slot}
          picking={replacing}
          latest={latest}
          text={{
            claim:
              view.phase.kind === "AWAIT_REPLACEMENT"
                ? `${format(t.table.proved, { player: t.seat.you })} ${roleName(view.phase.role)}`
                : "",
            title: t.table.replaceTitle,
            drew: t.moment.drew,
            hint:
              view.phase.kind === "AWAIT_REPLACEMENT"
                ? format(t.table.replaceHint, {
                    role: roleName(view.phase.role),
                    count: picker.choices,
                  })
                : "",
            card: (n) => format(t.table.replaceCard, { n }),
          }}
          ability={ability}
          timer={timer}
          onPick={(deckIndex) => send({ type: "CHOOSE_REPLACEMENT", playerId: me.id, deckIndex })}
          onDone={() => setPicker(null)}
        />
      )}

      <LogSheet
        open={logOpen}
        lines={lines}
        title={t.table.log}
        closeLabel={t.table.close}
        onClose={() => setLogOpen(false)}
      />

      {moments.current && (
        <MomentOverlay
          key={moments.current.id}
          moment={moments.current}
          theme={theme}
          locale={locale}
          dict={dict}
          name={name}
          onSkip={moments.skip}
        />
      )}

      {view.phase.kind === "GAME_OVER" && !moments.current && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-outline/80 p-6">
          <Confetti theme={theme} />
          <div className="relative z-40 flex w-full max-w-sm animate-[pop-in_400ms_cubic-bezier(.3,1.6,.6,1)] flex-col items-center gap-4 rounded-3xl border-3 border-outline bg-panel p-6 text-center shadow-hard">
            {seatById.get(view.phase.winnerId) && (
              <Avatar
                theme={theme}
                character={(seatById.get(view.phase.winnerId) as { avatar: Role }).avatar}
                className="size-24 animate-bounce"
              />
            )}
            <p className="text-game text-3xl">
              {view.phase.winnerId === view.viewerId
                ? t.over.youWon
                : format(t.over.theyWon, { player: name(view.phase.winnerId) })}
            </p>
            <GameButton variant="primary" onClick={onNewGame}>
              {againLabel ?? t.over.again}
            </GameButton>
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setLogOpen(true)}
                className="font-bold text-gold underline underline-offset-4"
              >
                {t.table.log}
              </button>
              <Link
                href={`/${locale}`}
                className="font-bold text-gold underline underline-offset-4"
              >
                {t.over.home}
              </Link>
            </div>
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
      case "AWAIT_REPLACEMENT":
        return phase.playerId === view.viewerId
          ? t.table.replaceTitle
          : format(t.table.replacingThem, { player: name(phase.playerId) });
      case "GAME_OVER":
        return format(t.over.theyWon, { player: name(phase.winnerId) });
    }
  }

  /** The ended turn's story, while the table pauses before the next player acts. */
  function recapLines(): string[] | null {
    if (!moments.recap || view.phase.kind !== "AWAIT_ACTION") return null;
    const described = moments.recap.events
      .map((e) => describeEvent(e, ctx))
      .filter((l): l is string => l !== null);
    return described.length > 0 ? described.slice(-3) : null;
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
  CHOOSE_REPLACEMENT: 3,
};

const TALLY_KEY = "chibi-bluff:show-tally";

/** Whether to show the "cards out" tally; remembered per browser, on by default. */
function useTallyPreference(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(TALLY_KEY) === "0") setShow(false);
    } catch {
      // Storage can be unavailable (private mode); keep the default.
    }
  }, []);
  return [
    show,
    (next) => {
      setShow(next);
      try {
        localStorage.setItem(TALLY_KEY, next ? "1" : "0");
      } catch {
        // Ignore: the choice just won't persist.
      }
    },
  ];
}

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
