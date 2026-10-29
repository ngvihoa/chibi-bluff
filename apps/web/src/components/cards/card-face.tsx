// Card front (docs/ui-design.md §3). The frame and all text are drawn here so they follow the
// theme colours and the current language; the theme only supplies the character art.
// Works in both Server and Client Components (no hooks).

import type { Role } from "@chibi-bluff/engine";
import { type ThemeLocale, type ThemeManifest, themeAssetUrl } from "@chibi-bluff/themes";
import type { CSSProperties } from "react";
import { RoleBadge } from "./role-badge";

export const OUTLINE = "#1d1230";
const GOLD = "#ffd23f";

/** Light rays behind the character, centred on the head. */
const RAYS = Array.from({ length: 18 }, (_, i) => {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(150 + 300 * Math.cos(rad)).toFixed(1)} ${(180 + 300 * Math.sin(rad)).toFixed(1)}`;
  };
  return `M150 180 L${point(i * 20)} L${point(i * 20 + 9)} Z`;
}).join(" ");

export interface CardFaceProps {
  theme: ThemeManifest;
  character: Role;
  locale: ThemeLocale;
  /** Localized one-line ability text. */
  ability: string;
  /** Face up because the influence was lost (R-IN-2). */
  lost?: boolean;
  selected?: boolean;
  /** Your own face-down card: shows the "only you can see this" eye. */
  owned?: boolean;
  /** Art and frame only, for small seats where text would be unreadable. */
  compact?: boolean;
  /** Accessible label suffix, e.g. "lost" / "only you can see this card". */
  labels?: { lost: string; owned: string };
  className?: string;
  /** E.g. a staggered animation delay. */
  style?: CSSProperties;
}

export function CardFace({
  theme,
  character,
  locale,
  ability,
  lost = false,
  selected = false,
  owned = false,
  compact = false,
  labels,
  className = "",
  style,
}: CardFaceProps) {
  const skin = theme.roles[character];
  const name = skin.name[locale];
  const id = `card-${theme.id}-${character}`;
  const label = [`${name} (${character})`, lost && labels?.lost, owned && !lost && labels?.owned]
    .filter(Boolean)
    .join(", ");

  return (
    <svg
      viewBox="0 0 300 450"
      role="img"
      aria-label={label}
      data-character={character}
      data-state={lost ? "lost" : selected ? "selected" : "normal"}
      className={`block font-sans transition duration-200 ease-[cubic-bezier(.3,1.6,.6,1)] ${
        lost ? "rotate-[8deg] brightness-60 grayscale-[.85]" : ""
      } ${selected ? "-translate-y-2 drop-shadow-[0_0_14px_#ffd23f]" : ""} ${className}`}
      style={style}
    >
      <defs>
        <radialGradient id={`${id}-panel`} cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor={skin.panel[0]} />
          <stop offset="1" stopColor={skin.panel[1]} />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="18" y="18" width="264" height={compact ? 414 : 330} rx="18" />
        </clipPath>
      </defs>

      <rect
        x="4"
        y="4"
        width="292"
        height="442"
        rx="28"
        fill={skin.color}
        stroke={OUTLINE}
        strokeWidth="6"
      />
      <rect
        x="18"
        y="18"
        width="264"
        height={compact ? 414 : 330}
        rx="18"
        fill={`url(#${id}-panel)`}
      />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={RAYS} fill="#fff" opacity="0.22" />
        <image
          href={themeAssetUrl(theme, skin.art)}
          x="0"
          y={compact ? 40 : 0}
          width="300"
          height="360"
        />
      </g>
      <rect
        x="18"
        y="18"
        width="264"
        height={compact ? 414 : 330}
        rx="18"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="4"
      />

      {!compact && (
        <>
          <RoleBadge character={character} />
          <path
            d="M10 362 H290 L276 388 L290 414 H10 L24 388 Z"
            fill={GOLD}
            stroke={OUTLINE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <text
            x="150"
            y="398"
            textAnchor="middle"
            fontWeight="800"
            fontSize={name.length > 15 ? 23 : 27}
            fill="#fff"
            stroke={OUTLINE}
            strokeWidth="6"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {name}
          </text>
          <text
            x="150"
            y="436"
            textAnchor="middle"
            fontWeight="700"
            fontSize={ability.length > 30 ? 13 : 15}
            fill="#fff"
            stroke={OUTLINE}
            strokeWidth="4"
            paintOrder="stroke"
          >
            {ability}
          </text>
        </>
      )}

      {owned && !lost && <OwnedEye compact={compact} />}
    </svg>
  );
}

/** Small eye in the top-right corner: "only you can see this card". */
function OwnedEye({ compact }: { compact: boolean }) {
  const s = compact ? 1.8 : 1;
  return (
    <g transform={`translate(${compact ? 236 : 254} ${compact ? 64 : 46}) scale(${s})`}>
      <circle r="20" fill="#fff" stroke={OUTLINE} strokeWidth="4" />
      <path
        d="M-12 0 Q0 -11 12 0 Q0 11 -12 0 Z"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle r="4.5" fill={OUTLINE} />
    </g>
  );
}
