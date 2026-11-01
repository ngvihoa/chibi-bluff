// Chibi Bluff service worker (docs/architecture.md §6.1). Checkpoint 26: just enough to make the
// game installable, plus a friendly page instead of the browser's error when the network is gone.
// Pages and files are not kept for offline play yet (checkpoint 27).

// Bump to replace what earlier versions saved.
const VERSION = "v1";
const CACHE = `chibi-bluff-${VERSION}`;
const OFFLINE_PAGE = "/offline.html";
const OFFLINE_FILES = [OFFLINE_PAGE, "/icons/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_FILES)));
  // A new version takes over at once: pages always come from the network anyway.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("chibi-bluff-") && n !== CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Page loads only; everything else (files, data, the game server) goes straight to the network.
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_PAGE)) ?? Response.error();
    }),
  );
});
