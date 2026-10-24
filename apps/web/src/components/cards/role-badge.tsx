// Ability badge in the card's top-left corner. Depends on the role's rules, not on the theme,
// so every theme shows the same badges (docs/ui-design.md §3.1).

import type { Role } from "@chibi-bluff/engine";

const OUTLINE = "#1d1230";

export function RoleBadge({ character }: { character: Role }) {
  return (
    <g>
      <circle cx="46" cy="46" r="26" fill="#ffd23f" stroke={OUTLINE} strokeWidth="4" />
      <BadgeContent character={character} />
    </g>
  );
}

function BadgeContent({ character }: { character: Role }) {
  const text = (value: string) => (
    <text x="46" y="55" textAnchor="middle" fontWeight="800" fontSize="22" fill={OUTLINE}>
      {value}
    </text>
  );
  switch (character) {
    case "duke":
      return text("+3");
    case "assassin":
      return text("−3");
    case "captain":
      return text("+2");
    case "ambassador":
      return (
        <g
          fill="none"
          stroke={OUTLINE}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M34 42 Q36 32 48 32 H56 M51 26 L57 32 L51 38" />
          <path d="M58 50 Q56 60 44 60 H36 M41 66 L35 60 L41 54" />
        </g>
      );
    case "contessa":
      return (
        <path
          d="M46 30 L60 35 Q60 54 46 62 Q32 54 32 35 Z"
          fill="#fff"
          stroke={OUTLINE}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      );
  }
}
