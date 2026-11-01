"use client";

import { useEffect } from "react";
// Loaded on every page so the install event is caught whichever page it fires on.
import "./install";

/** Registers the service worker (docs/architecture.md §6.1), in production builds only: in
 *  development it would keep serving files the dev server has already replaced. Then asks it to
 *  keep this deploy's pages for offline play. */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      // Keep the offline pages from this deploy (the worker skips it if it already has them).
      .then((registration) =>
        registration.active?.postMessage({
          type: "warm",
          version: process.env.NEXT_PUBLIC_DEPLOY_ID,
        }),
      )
      .catch((error) => console.warn("Service worker not registered", error));
  }, []);
  return null;
}
