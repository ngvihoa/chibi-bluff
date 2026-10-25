// Small chibi-style icons for the table (thick outline, flat colours; docs/ui-design.md §2.4).

import type { SVGProps } from "react";

const O = "#1d1230";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  if (title) {
    return (
      <svg viewBox="0 0 64 64" role="img" {...rest}>
        <title>{title}</title>
        {children}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** One silver ingot: Income. */
export function IncomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Ingot x={32} y={38} s={0.62} />
    </Svg>
  );
}

/** Two ingots on an open hand: Foreign aid. */
export function ForeignAidIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M8 46 Q20 40 30 44 L44 44 Q50 44 50 48 Q50 52 44 52 L28 52 Q16 56 8 54 Z"
        fill="#ffdcbf"
        stroke={O}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <Ingot x={24} y={30} s={0.4} />
      <Ingot x={42} y={28} s={0.4} />
    </Svg>
  );
}

/** Crossed swords: Coup. */
export function CoupIcon(props: IconProps) {
  const sword = (rotate: number) => (
    <g transform={`rotate(${rotate} 32 32)`} stroke={O} strokeWidth="3" strokeLinejoin="round">
      <rect x="29" y="6" width="6" height="34" rx="3" fill="#e6eef8" />
      <rect x="22" y="38" width="20" height="5" rx="2" fill="#ffd23f" />
      <rect x="29" y="43" width="6" height="12" rx="2" fill="#e85d75" />
    </g>
  );
  return (
    <Svg {...props}>
      {sword(-38)}
      {sword(38)}
    </Svg>
  );
}

/** Small theatre mask: "you are bluffing". */
export function MaskIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M10 18 Q32 8 54 18 Q56 40 32 56 Q8 40 10 18 Z"
        fill="#fff"
        stroke={O}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M20 28 Q25 23 30 28 Q25 31 20 28 Z M34 28 Q39 23 44 28 Q39 31 34 28 Z" fill={O} />
      <path
        d="M24 42 Q32 47 40 42"
        fill="none"
        stroke={O}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Scroll: game log. */
export function ScrollIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="14" y="12" width="36" height="40" rx="4" fill="#fff6e6" stroke={O} strokeWidth="4" />
      <path
        d="M22 24 H42 M22 32 H42 M22 40 H34"
        stroke={O}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Abacus: the "cards out" tally. */
export function TallyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#c98a12" stroke={O} strokeWidth="4" />
      <path d="M14 22 H50 M14 32 H50 M14 42 H50" stroke={O} strokeWidth="3" />
      <g stroke={O} strokeWidth="2.5">
        <circle cx="22" cy="22" r="4.5" fill="#e85d75" />
        <circle cx="34" cy="32" r="4.5" fill="#2f8fe0" />
        <circle cx="26" cy="42" r="4.5" fill="#3fae5a" />
        <circle cx="42" cy="22" r="4.5" fill="#ffd23f" />
      </g>
    </Svg>
  );
}

/** Speech bubble with a grin: stickers. */
export function StickerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M10 14 H54 Q58 14 58 18 V40 Q58 44 54 44 H28 L16 54 L18 44 H10 Q6 44 6 40 V18 Q6 14 10 14 Z"
        fill="#ffd23f"
        stroke={O}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="26" r="3" fill={O} />
      <circle cx="40" cy="26" r="3" fill={O} />
      <path
        d="M22 33 Q32 40 42 33"
        fill="none"
        stroke={O}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Door with an arrow: leave the table. */
export function LeaveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="10" y="10" width="26" height="44" rx="3" fill="#7d6f9c" stroke={O} strokeWidth="4" />
      <path
        d="M30 32 H54 M46 24 L54 32 L46 40"
        fill="none"
        stroke={O}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Ingot({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      stroke={O}
      strokeWidth={4 / s}
      strokeLinejoin="round"
    >
      <path d="M-24 8 Q-24 -24 0 -24 Q24 -24 24 8 Z" fill="#f2f6ff" />
      <path
        d="M-46 -14 Q-40 -20 -32 -12 Q-24 2 0 2 Q24 2 32 -12 Q40 -20 46 -14 Q44 22 0 24 Q-44 22 -46 -14 Z"
        fill="#c9d3e6"
      />
    </g>
  );
}
