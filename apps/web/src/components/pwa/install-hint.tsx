"use client";

// "Install the game" on the home page (docs/architecture.md §6.1): opens the browser's install
// dialog where there is one (Chromium), or explains the Share menu on iOS. Hidden once installed,
// and in browsers that cannot install.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { installWay, promptInstall, subscribeInstall } from "./install";

/** Unknown while prerendering: nothing is shown until the browser can tell. */
const ON_SERVER = () => null;

export function InstallHint() {
  const { dict } = useI18n();
  const t = dict.home.install;
  const way = useSyncExternalStore(subscribeInstall, installWay, ON_SERVER);
  const [steps, setSteps] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (steps && !el.open) el.showModal();
    if (!steps && el.open) el.close();
  }, [steps]);

  if (!way) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => (way === "prompt" ? void promptInstall() : setSteps(true))}
        className="mx-auto flex items-center gap-2 rounded-full border-3 border-outline bg-panel px-4 py-2 text-sm font-extrabold shadow-hard-sm active:translate-y-0.5"
      >
        <InstallIcon />
        {t.button}
      </button>
      <dialog
        ref={dialog}
        onClose={() => setSteps(false)}
        onClick={(e) => e.target === dialog.current && setSteps(false)}
        onKeyDown={(e) => e.key === "Escape" && setSteps(false)}
        aria-labelledby="install-title"
        className="mx-auto mt-auto mb-0 w-full max-w-md rounded-t-3xl border-3 border-b-0 border-outline bg-panel p-0 text-ink backdrop:bg-outline/70 lg:my-auto lg:rounded-3xl lg:border-b-3"
      >
        <div className="flex items-center justify-between gap-3 border-b-3 border-outline px-4 py-3">
          <h2 id="install-title" className="text-game-sm text-lg">
            {t.iosTitle}
          </h2>
          <button
            type="button"
            onClick={() => setSteps(false)}
            className="shrink-0 rounded-full bg-outline px-3 py-1 text-sm font-bold text-gold"
          >
            {dict.game.table.close}
          </button>
        </div>
        <ol className="flex flex-col gap-3 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {t.iosSteps.map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold font-extrabold text-outline">
                {i + 1}
              </span>
              <span>{step}</span>
              {i === 0 && <ShareIcon />}
            </li>
          ))}
        </ol>
      </dialog>
    </>
  );
}

function InstallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor">
      <rect x="6" y="2.5" width="12" height="19" rx="3" strokeWidth="2.2" />
      <path d="M12 8v7M9 12.5l3 3 3-3" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** The iOS Share button, so players know what to look for. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-[#4aa3ff]" aria-hidden fill="none">
      <path
        d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16M12 3v12M8.5 6.5 12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
