// Minimal service worker so netflixme is installable as a PWA and the app shell
// loads offline. We intentionally keep it conservative: never cache API responses
// (they hold personal list data + change often) — only cache the static shell.
const CACHE = "netflixme-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never intercept API or auth traffic.
  if (url.pathname.startsWith("/api/")) return;
  // Network-first for navigations so fresh data wins; fall back to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }
  // Cache-first for other static GETs.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
