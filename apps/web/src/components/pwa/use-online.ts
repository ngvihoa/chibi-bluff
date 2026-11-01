// Whether the browser has a network connection (docs/architecture.md §6.1). `navigator.onLine`
// can say "online" on a network with no internet, so this only catches the clear cases; it is
// enough to tell offline players why online play cannot start.

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Assumed online while prerendering. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
