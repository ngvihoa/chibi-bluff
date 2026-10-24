import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "gold" | "neutral";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-linear-to-b from-[#ff6b5a] to-danger",
  gold: "bg-linear-to-b from-[#ffe27a] to-gold text-outline",
  neutral: "bg-linear-to-b from-[#a99cc4] to-[#7d6f9c]",
};

const BASE =
  "relative flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-3 border-outline px-5 pb-1.5 pt-1 text-xl font-extrabold shadow-hard transition active:translate-y-1 active:shadow-hard-pressed";

interface Props {
  variant?: Variant;
  /** Small badge in the corner, e.g. "Soon". */
  badge?: ReactNode;
  children: ReactNode;
}

/** Chunky game-style button (docs/ui-design.md §2.4). Renders a link when `href` is given. */
export function GameButton({
  variant = "primary",
  badge,
  children,
  href,
  ...rest
}: Props &
  (
    | { href: ComponentProps<typeof Link>["href"] }
    | ({ href?: undefined } & ComponentProps<"button">)
  )) {
  const className = `${BASE} ${VARIANTS[variant]} ${variant === "gold" ? "" : "text-game"} disabled:cursor-not-allowed disabled:opacity-70 disabled:saturate-50 disabled:active:translate-y-0`;
  const content = (
    <>
      {children}
      {badge && (
        <span className="absolute -right-2 -top-3 rotate-6 rounded-lg border-2 border-outline bg-gold px-2 text-xs font-extrabold text-outline [-webkit-text-stroke:0] [text-shadow:none]">
          {badge}
        </span>
      )}
    </>
  );
  if (href !== undefined) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} {...rest}>
      {content}
    </button>
  );
}
