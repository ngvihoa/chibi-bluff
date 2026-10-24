"use client";

import type { ReactNode } from "react";

/**
 * Panel that slides up over the action bar, inside the thumb zone (docs/ui-design.md §4.1).
 * Not modal: the table above stays visible so players can read the situation while deciding.
 */
export function BottomSheet({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  /** Right side of the header, e.g. the incense timer. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-live="polite"
      className="animate-[sheet-in_220ms_cubic-bezier(.3,1.4,.6,1)] rounded-t-3xl border-3 border-b-0 border-outline bg-panel px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-6px_0_var(--color-outline)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-extrabold leading-tight">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
