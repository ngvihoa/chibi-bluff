import type { PlayerViewPlayer } from "@chibi-bluff/engine";
import { type ThemeLocale, type ThemeManifest, themeAssetUrl } from "@chibi-bluff/themes";
import { CardBack } from "@/components/cards/card-back";
import { CardFace } from "@/components/cards/card-face";
import { EmptySlot } from "@/components/cards/empty-slot";
import type { SeatInfo } from "@/game/host";
import { cardSlots } from "@/game/table-model";
import type { CoinFloat } from "@/game/use-moments";
import { Avatar } from "./avatar";
import { CoinFloats } from "./moments";

export interface OpponentSeatProps {
  player: PlayerViewPlayer;
  seat: SeatInfo;
  theme: ThemeManifest;
  locale: ThemeLocale;
  active: boolean;
  /** Pick this seat as the target of the pending action. */
  onTarget?: () => void;
  text: { bot: string; out: string; back: string; awaiting: string; lost: string; owned: string };
  floats: CoinFloat[];
  /** Hand slot to show empty while this player picks a replacement. */
  emptySlot?: number | null;
}

/** Compact opponent chip for the 3-column grid (docs/ui-design.md §4.1). */
export function OpponentSeat({
  player,
  seat,
  theme,
  locale,
  active,
  onTarget,
  text,
  floats,
  emptySlot,
}: OpponentSeatProps) {
  const content = (
    <>
      <CoinFloats floats={floats} playerId={player.id} />
      <div className="flex items-center gap-1">
        <Avatar theme={theme} character={seat.avatar} className="size-8 border-2" />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-extrabold leading-tight tracking-tight">
            {seat.name}
          </p>
          <p className="flex items-center gap-1 text-xs leading-tight">
            {seat.kind === "bot" && (
              <span className="rounded bg-gold px-1 text-[10px] font-extrabold text-outline">
                {text.bot}
              </span>
            )}
            {player.eliminated ? (
              <span className="text-muted">{text.out}</span>
            ) : (
              <Coins theme={theme} amount={player.coins} />
            )}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex justify-center gap-1">
        {cardSlots(player).map(({ key, card, index }) =>
          index === emptySlot ? (
            <EmptySlot key={`${key}:empty`} label={text.awaiting} className="w-7 border-2" />
          ) : card.revealed ? (
            <CardFace
              key={`${key}:lost`}
              theme={theme}
              character={card.role}
              locale={locale}
              ability=""
              compact
              lost
              labels={{ lost: text.lost, owned: text.owned }}
              className="w-7 animate-[flip-in_500ms_ease-out]"
            />
          ) : (
            <CardBack
              key={key}
              theme={theme}
              locale={locale}
              label={text.back}
              compact
              className="w-7"
            />
          ),
        )}
      </div>
    </>
  );

  const frame = `relative rounded-2xl border-3 bg-panel p-1.5 transition ${
    active ? "border-gold shadow-[0_0_14px_#ffd23f]" : "border-outline shadow-hard-sm"
  } ${player.eliminated ? "opacity-45 grayscale" : ""}`;

  if (onTarget) {
    return (
      <button
        type="button"
        data-seat={player.id}
        onClick={onTarget}
        className={`${frame} animate-[target_1s_ease-in-out_infinite] ring-4 ring-danger`}
      >
        {content}
      </button>
    );
  }
  return (
    <div data-seat={player.id} className={frame}>
      {content}
    </div>
  );
}

export function Coins({
  theme,
  amount,
  className = "",
}: {
  theme: ThemeManifest;
  amount: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 font-extrabold text-gold ${className}`}>
      {/* biome-ignore lint/performance/noImgElement: tiny decorative SVG from the theme */}
      <img src={themeAssetUrl(theme, theme.currency.icon)} alt="" className="size-[1.1em]" />
      {amount}
    </span>
  );
}
