"use client";

import { useEffect, useRef } from "react";

/** Full game log in a dialog sheet, newest at the bottom. */
export function LogSheet({
  open,
  lines,
  title,
  closeLabel,
  onClose,
}: {
  open: boolean;
  lines: string[];
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="mx-auto mt-auto mb-0 max-h-[70dvh] w-full max-w-md rounded-t-3xl border-3 border-b-0 border-outline bg-panel p-0 text-ink backdrop:bg-outline/70"
    >
      <div className="flex items-center justify-between border-b-3 border-outline px-4 py-3">
        <h2 className="text-game-sm text-lg">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-outline px-3 py-1 text-sm font-bold text-gold"
        >
          {closeLabel}
        </button>
      </div>
      <ol className="flex flex-col gap-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm">
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
          <li key={i} className={i === lines.length - 1 ? "text-ink" : "text-muted"}>
            {line}
          </li>
        ))}
        <li ref={end} aria-hidden />
      </ol>
    </dialog>
  );
}
