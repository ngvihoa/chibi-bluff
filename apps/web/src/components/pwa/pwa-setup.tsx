"use client";

import { useEffect } from "react";
// Loaded on every page so the install event is caught whichever page it fires on.
import "./install";

/** Registers the service worker (docs/architecture.md §6.1), in production builds only: in
 *  development it would keep serving files the dev server has already replaced. */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.warn("Service worker not registered", error));
  }, []);
  return null;
}
