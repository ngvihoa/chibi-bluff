// Installing the game as an app (docs/architecture.md §6.1). Chromium browsers offer their own
// install dialog through `beforeinstallprompt`, which may fire before any page component mounts,
// so it is caught here as soon as this module loads. iOS has no such event: players add the game
// from the Share menu, so the hint explains how.

/** Chromium's install event (not in TypeScript's DOM types). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallWay = "prompt" | "ios" | null;

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of listeners) listener();
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for our own button instead of the browser's mini bar.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    changed();
  });
}

/** Already running as an installed app. */
function standalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone, iPad (which reports itself as a Mac with touch) or iPod. */
function ios(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** How this browser can install the game, if it can and it is not installed yet. */
export function installWay(): InstallWay {
  if (typeof window === "undefined" || standalone()) return null;
  if (deferred) return "prompt";
  return ios() ? "ios" : null;
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the browser's install dialog (Chromium). */
export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  // The event can only be used once.
  deferred = null;
  await event.prompt();
  await event.userChoice;
  changed();
}
