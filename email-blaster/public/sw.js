// Bump this version on every deploy to invalidate caches
const APP_VERSION = "v3";
const CACHE_NAME = `email-blaster-${APP_VERSION}`;
const OFFLINE_URL = "/";

const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Don't auto-activate — wait for user confirmation via skipWaiting message
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Delete all old caches
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API routes — always go to network
  if (url.pathname.startsWith("/api/")) return;

  // Never cache the version file — always fresh
  if (url.pathname === "/version.json") return;

  if (event.request.method !== "GET") return;

  // Network-first for navigation (HTML pages)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: APP_VERSION });
  }
});
