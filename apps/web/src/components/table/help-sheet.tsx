"use client";

// Quick rules from the table (docs/ui-design.md §10.1): the reference section that fits what the
// game is waiting for, in a sheet over the table. The game keeps running underneath; the full
// reference opens in a new tab so a game against bots (which lives in this tab) is never lost.

import type { ThemeLocale, ThemeManifest } from "@chibi-bluff/themes";
import { useEffect, useRef } from "react";
import { ReferenceSection, type ReferenceSectionId } from "@/components/rules/reference-section";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";

export function HelpSheet({
  open,
  topic,
  dict,
  theme,
  locale,
  onClose,
}: {
  open: boolean;
  topic: ReferenceSectionId;
  dict: Dictionary;
  theme: ThemeManifest;
  locale: ThemeLocale;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = dict.rules.help;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      aria-labelledby="help-title"
      className="mx-auto mt-auto mb-0 max-h-[75dvh] w-full max-w-md rounded-t-3xl border-3 border-b-0 lg:my-auto lg:max-w-xl lg:rounded-3xl lg:border-b-3 border-outline bg-panel p-0 text-ink backdrop:bg-outline/70"
    >
      <div className="flex items-center justify-between gap-3 border-b-3 border-outline px-4 py-3">
        <h2 id="help-title" className="text-game-sm text-lg">
          {format(t.title, { topic: dict.rules.reference.sections[topic].title })}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full bg-outline px-3 py-1 text-sm font-bold text-gold"
        >
          {dict.game.table.close}
        </button>
      </div>
      <div className="overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {open && <ReferenceSection id={topic} dict={dict} theme={theme} locale={locale} />}
        <a
          href={`/${locale}/rules/reference#${topic}`}
          target="_blank"
          rel="noopener"
          className="mt-4 block text-center font-bold text-gold underline underline-offset-4"
        >
          {t.full}
        </a>
      </div>
    </dialog>
  );
}
