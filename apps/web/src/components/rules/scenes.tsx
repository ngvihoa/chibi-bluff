// The little scene on each storyboard page (docs/ui-design.md §10.2), built from the table's own
// pieces so newcomers see exactly what they will meet in a game.

import { ROLES, type Role } from "@chibi-bluff/engine";
import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import type { ReactNode } from "react";
import { CardBack } from "@/components/cards/card-back";
import { CardFace } from "@/components/cards/card-face";
import { Avatar } from "@/components/table/avatar";
import { CoupIcon, ForeignAidIcon, IncomeIcon, MaskIcon } from "@/components/table/icons";
import { Coins } from "@/components/table/opponent-seat";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

export interface SceneProps {
  theme: ThemeManifest;
  locale: ThemeLocale;
  dict: Dictionary;
}

function Stamp({ tone, children }: { tone: "red" | "gold"; children: ReactNode }) {
  const colors =
    tone === "red" ? "border-danger text-danger bg-white/90" : "border-gold text-outline bg-gold";
  return (
    <span
      className={`absolute -bottom-3 left-1/2 -translate-x-1/2 rotate-[-10deg] animate-[stamp_350ms_cubic-bezier(.3,1.6,.6,1)_1100ms_both] rounded-lg border-3 px-2 text-sm font-extrabold whitespace-nowrap uppercase shadow-hard-sm ${colors}`}
    >
      {children}
    </span>
  );
}

const CHIP_TONES = {
  panel: "bg-panel text-ink",
  danger: "bg-danger text-ink",
  gold: "bg-gold text-outline",
} as const;

function Chip({
  children,
  tone = "panel",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof CHIP_TONES;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-2xl border-3 border-outline px-2.5 py-1 text-sm font-extrabold shadow-hard-sm ${CHIP_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const name = (theme: ThemeManifest, locale: ThemeLocale, role: Role) =>
  theme.roles[role].name[locale];

function Winner({ theme, dict }: SceneProps) {
  const t = dict.rules.learn.scene;
  return (
    <div className="flex items-end justify-center gap-5">
      {(["assassin", "duke", "contessa"] as const).map((role, i) => (
        <div key={role} className="flex flex-col items-center gap-1">
          <Avatar
            theme={theme}
            character={role}
            className={i === 1 ? "size-24 animate-bounce" : "size-16 opacity-40 grayscale"}
          />
          <span className={`text-sm font-extrabold ${i === 1 ? "text-gold" : "text-muted"}`}>
            {i === 1 ? t.winner : t.out}
          </span>
        </div>
      ))}
    </div>
  );
}

function YourCards({ theme, locale, dict }: SceneProps) {
  const labels = { lost: dict.cards.lost, owned: dict.cards.yours };
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        {(["duke", "contessa"] as const).map((role, i) => (
          <CardFace
            key={role}
            theme={theme}
            character={role}
            locale={locale}
            ability=""
            owned
            compact
            labels={labels}
            className={`w-24 ${i ? "rotate-3" : "-rotate-3"} animate-[deal_500ms_cubic-bezier(.3,1.4,.6,1)_both]`}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1.5">
          {ROLES.map((role) => (
            <Avatar key={role} theme={theme} character={role} className="size-9 border-2" />
          ))}
        </div>
        <span className="text-xs font-bold text-muted">{dict.rules.learn.scene.copies}</span>
      </div>
    </div>
  );
}

function Taels({ theme, locale, dict }: SceneProps) {
  const a = dict.game.actions;
  return (
    <div className="flex flex-col items-center gap-4">
      <Coins theme={theme} amount={2} className="animate-[pop-in_400ms_both] text-6xl" />
      <div className="flex gap-2">
        <Chip>
          <span className="rounded-full bg-gold px-1.5 text-outline">−3</span>
          {a.assassinate}
        </Chip>
        <Chip>
          <span className="rounded-full bg-gold px-1.5 text-outline">−7</span>
          {a.coup}
        </Chip>
      </div>
      <span className="sr-only">{theme.currency[locale]}</span>
    </div>
  );
}

function Turn({ theme, dict }: SceneProps) {
  const a = dict.game.actions;
  const actions = [
    "income",
    "foreignAid",
    "coup",
    "tax",
    "assassinate",
    "steal",
    "exchange",
  ] as const;
  const claims: Partial<Record<(typeof actions)[number], Role>> = {
    tax: "duke",
    assassinate: "assassin",
    steal: "captain",
    exchange: "ambassador",
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-game-sm text-lg">{dict.rules.learn.scene.yourTurn}</span>
      <div className="grid w-full max-w-xs grid-cols-4 gap-1.5">
        {actions.map((action, i) => {
          const role = claims[action];
          return (
            <span
              key={action}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 border-outline bg-panel p-1 text-[10px] font-extrabold ${
                i === 3 ? "animate-pulse ring-3 ring-gold" : ""
              }`}
            >
              {role ? (
                <Avatar theme={theme} character={role} className="size-6 border-2" />
              ) : (
                <span className="size-6" />
              )}
              {a[action]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function General({ dict }: SceneProps) {
  const a = dict.game.actions;
  const items = [
    { Icon: IncomeIcon, label: a.income, badge: "+1", gain: true },
    { Icon: ForeignAidIcon, label: a.foreignAid, badge: "+2", gain: true },
    { Icon: CoupIcon, label: a.coup, badge: "−7", gain: false },
  ];
  return (
    <div className="flex justify-center gap-3">
      {items.map(({ Icon, label, badge, gain }, i) => (
        <span
          key={label}
          className="relative flex w-24 animate-[pop-in_350ms_both] flex-col items-center gap-1 rounded-2xl border-3 border-outline bg-panel py-3 font-extrabold shadow-hard-sm"
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <span
            className={`absolute -top-2.5 -left-1.5 rounded-full border-2 border-outline px-1.5 text-xs text-outline ${gain ? "bg-gain" : "bg-gold"}`}
          >
            {badge}
          </span>
          <Icon className="size-10" />
          <span className="text-xs">{label}</span>
        </span>
      ))}
    </div>
  );
}

function Claim({ theme, locale, dict }: SceneProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex -space-x-5">
        {ROLES.map((role, i) => (
          <CardFace
            key={role}
            theme={theme}
            character={role}
            locale={locale}
            ability=""
            compact
            className="w-16 animate-[deal_450ms_both]"
            style={{ animationDelay: `${i * 90}ms` }}
            labels={{ lost: dict.cards.lost, owned: dict.cards.yours }}
          />
        ))}
      </div>
      <div className="relative">
        <CardBack theme={theme} locale={locale} label={dict.cards.back} compact className="w-16" />
        <MaskIcon className="absolute -top-3 -right-4 size-9 animate-[wiggle_600ms_ease-in-out_700ms_both]" />
      </div>
    </div>
  );
}

function Challenge({ theme, locale, dict }: SceneProps) {
  const t = dict.rules.learn.scene;
  const m = dict.game.moment;
  const labels = { lost: dict.cards.lost, owned: dict.cards.yours };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <Avatar theme={theme} character="duke" className="size-10 border-2" />
        <Chip>
          {format(t.claims, { player: name(theme, locale, "duke") })}: {t.tax}
        </Chip>
        <Chip tone="danger" className="animate-[pop-in_300ms_500ms_both]">
          {dict.game.respond.challenge}
        </Chip>
      </div>
      <div className="flex gap-6 pt-1">
        <div className="relative animate-[flip-in_500ms_ease-out_800ms_both]">
          <CardFace
            theme={theme}
            character="captain"
            locale={locale}
            ability=""
            compact
            lost
            labels={labels}
            className="w-20"
          />
          <Stamp tone="red">{m.caught}</Stamp>
        </div>
        <div className="relative animate-[flip-in_500ms_ease-out_800ms_both]">
          <CardFace
            theme={theme}
            character="duke"
            locale={locale}
            ability=""
            compact
            labels={labels}
            className="w-20 drop-shadow-[0_0_14px_#ffd23f]"
          />
          <Stamp tone="gold">{m.truthful}</Stamp>
        </div>
      </div>
    </div>
  );
}

function Block({ theme, locale, dict }: SceneProps) {
  const a = dict.game.actions;
  const rows: [Role[], string][] = [
    [["duke"], a.foreignAid],
    [["captain", "ambassador"], a.steal],
    [["contessa"], a.assassinate],
  ];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <Chip>
          <Avatar theme={theme} character="assassin" className="size-6 border-2" />
          {dict.rules.learn.scene.assassinateYou}
        </Chip>
        <Chip tone="gold" className="animate-[pop-in_300ms_500ms_both]">
          {format(dict.game.respond.block, { role: name(theme, locale, "contessa") })}
        </Chip>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([roles, action]) => (
          <li key={action} className="flex items-center gap-2 text-sm font-bold">
            <span className="flex -space-x-2">
              {roles.map((role) => (
                <Avatar key={role} theme={theme} character={role} className="size-8 border-2" />
              ))}
            </span>
            <span className="text-muted">{dict.rules.reference.columns.blocks}:</span>
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lose({ theme, locale, dict }: SceneProps) {
  const labels = { lost: dict.cards.lost, owned: dict.cards.yours };
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        <CardFace
          theme={theme}
          character="duke"
          locale={locale}
          ability=""
          compact
          lost
          labels={labels}
          className="w-24 -rotate-3 animate-[flip-in_600ms_ease-out_600ms_both]"
        />
        <CardFace
          theme={theme}
          character="contessa"
          locale={locale}
          ability=""
          compact
          owned
          labels={labels}
          className="w-24 rotate-3"
        />
      </div>
      <Chip>
        <Avatar theme={theme} character="duke" className="size-6 border-2" />
        <span className="animate-[pop-in_300ms_1200ms_both] text-gold">1/3</span>
        <span className="text-xs text-muted">{dict.game.table.tally}</span>
      </Chip>
    </div>
  );
}

function Ready({ theme }: SceneProps) {
  return (
    <div className="flex justify-center -space-x-3">
      {ROLES.map((role, i) => (
        <Avatar
          key={role}
          theme={theme}
          character={role}
          className="size-16 animate-[pop-in_350ms_both]"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

/** One scene per storyboard page, in order. */
export const SCENES = [
  Winner,
  YourCards,
  Taels,
  Turn,
  General,
  Claim,
  Challenge,
  Block,
  Lose,
  Ready,
] as const;
