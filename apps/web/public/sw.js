// Chibi Bluff service worker (docs/architecture.md §6.1).
// - Checkpoint 26: installable; a friendly page instead of the browser's error when offline.
// - Checkpoint 28: the game sounds are kept too.
// - Checkpoint 27: playing against bots offline. The game runs entirely in the browser, so it
//   only needs its pages and files: those are kept here, and refreshed whenever there is network.
//
// Data Next fetches for in-app navigation (RSC) is never kept: data from one deploy with code from
// another could break the page. Offline, that fetch fails, Next falls back to loading the whole
// page, and the page comes from here together with the files of the same build.

// Bump to drop everything earlier versions kept.
const VERSION = "v2";
const STATIC = `chibi-bluff-static-${VERSION}`;
const PAGES = `chibi-bluff-pages-${VERSION}`;

const OFFLINE_PAGE = "/offline.html";
const CORE = [OFFLINE_PAGE, "/icons/icon-192.png", "/icon.svg"];
/** Pages kept for offline play, in both languages. Online rooms need the network anyway. */
const LOCALES = ["vi", "en"];
const PAGE_PATHS = ["", "/play/local", "/rules", "/rules/learn", "/rules/reference", "/rules/tips"];
const WARM_PAGES = LOCALES.flatMap((locale) => PAGE_PATHS.map((path) => `/${locale}${path}`));
/** The game's sounds (src/sound/player.ts; a unit test keeps both lists the same). */
const SOUNDS = [
  "block",
  "caught",
  "challenge",
  "coin-gain",
  "coin-loss",
  "deal",
  "declare",
  "eliminated",
  "lose",
  "lose-card",
  "sticker",
  "tick",
  "truthful",
  "turn",
  "win",
].map((name) => `/sounds/${name}.mp3`);
/** Where the theme sync script lists every theme file (scripts/sync-theme-assets.mjs). */
const THEME_FILES = "/themes/files.json";
/** Marks which deploy the kept pages come from. */
const WARMED = "/__warmed";

/** A page slower than this comes from the cache (when there is one) while it keeps loading. */
const NETWORK_TIMEOUT_MS = 3_000;
/** Old builds' files pile up in the cache; beyond this many the oldest go. */
const STATIC_LIMIT = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("chibi-bluff-") && !keep.has(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
      await warm(null);
    })(),
  );
});

// Pages send their deploy id after loading: a new deploy refreshes the kept pages and files.
self.addEventListener("message", (event) => {
  if (event.data?.type === "warm") event.waitUntil(warm(event.data.version ?? null));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // The game server, analytics and anything else elsewhere: straight to the network.
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(page(request, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    // Content-hashed names: a file never changes, so the cache is always right.
    event.respondWith(cacheFirst(request));
  } else if (
    url.pathname.startsWith("/themes/") ||
    url.pathname.startsWith("/sounds/") ||
    url.pathname.startsWith("/icons/") ||
    ["/icon.svg", "/favicon.ico", "/apple-icon.png"].includes(url.pathname)
  ) {
    // Same name across deploys: answer from the cache, refresh it in the background.
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

/** Pages: the network first, so players online always get the latest; the kept copy otherwise. */
async function page(request, url) {
  const pages = await caches.open(PAGES);
  // Query strings (e.g. ?speed=) do not change the page.
  const key = url.pathname;
  const fromNetwork = fetch(request).then((response) => {
    if (keepable(response, url)) pages.put(key, response.clone());
    return response;
  });
  // A late failure after the kept page was already served is nobody's concern.
  fromNetwork.catch(() => {});
  const kept = () => keptPage(pages, url);
  try {
    const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
    const first = await Promise.race([fromNetwork, timeout]);
    if (first) return first;
    // Slow network: the kept page if there is one, else keep waiting.
    return (await kept()) ?? (await fromNetwork);
  } catch {
    return (await kept()) ?? (await caches.match(OFFLINE_PAGE)) ?? Response.error();
  }
}

async function keptPage(pages, url) {
  const hit = await pages.match(url.pathname);
  if (hit) return hit;
  // Opened from the home screen ("/"): the server would pick the language; offline, the browser's.
  if (url.pathname === "/") return pages.match(`/${preferredLocale()}`);
  return undefined;
}

function keepable(response, url) {
  return (
    response.ok &&
    response.type === "basic" &&
    !response.redirected &&
    !/^\/(vi|en)\/(room|dev)\//.test(url.pathname)
  );
}

function preferredLocale() {
  const languages = self.navigator.languages ?? [self.navigator.language ?? ""];
  return languages.some((l) => l.toLowerCase().startsWith("vi")) ? "vi" : "en";
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request, { ignoreVary: true });
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) ?? Response.error();
}

/**
 * Keeps the offline pages and every file they need: the `/_next/static/...` files each page
 * refers to, and the theme's pictures. Skipped when the kept pages already come from `version`.
 */
async function warm(version) {
  const pages = await caches.open(PAGES);
  const marked = await pages.match(WARMED);
  if (version && marked && (await marked.text()) === version) return;

  const files = new Set();
  await Promise.all(
    WARM_PAGES.map(async (path) => {
      try {
        const response = await fetch(path, { cache: "no-cache" });
        if (!response.ok || response.redirected) return;
        const html = await response.clone().text();
        await pages.put(path, response);
        for (const match of html.matchAll(/\/_next\/static\/[^"'\\\s)<>]+/g)) files.add(match[0]);
      } catch {
        // Offline or a failed page: try again on the next warm-up.
      }
    }),
  );
  try {
    const themeFiles = await (await fetch(THEME_FILES, { cache: "no-cache" })).json();
    for (const file of themeFiles) files.add(file);
  } catch {
    // No list (or offline): theme pictures are still kept as the game shows them.
  }

  for (const file of SOUNDS) files.add(file);

  const statics = await caches.open(STATIC);
  await Promise.all(
    [...files].map(async (file) => {
      if (await statics.match(file, { ignoreVary: true })) return;
      try {
        const response = await fetch(file);
        if (response.ok) await statics.put(file, response);
      } catch {
        // Kept the next time it is fetched instead.
      }
    }),
  );
  if (version) await pages.put(WARMED, new Response(version));
  await trim(statics);
}

/** Drops the oldest files beyond the limit (cache keys come back in insertion order). */
async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - STATIC_LIMIT;
  if (extra <= 0) return;
  const core = new Set(CORE.map((path) => new URL(path, self.location.origin).href));
  await Promise.all(
    keys
      .filter((request) => !core.has(request.url))
      .slice(0, extra)
      .map((request) => cache.delete(request)),
  );
}
