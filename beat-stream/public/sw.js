const CACHE_NAME = "beatstream-v1";
const AUDIO_CACHE = "beatstream-audio-v1";
const IMAGE_CACHE = "beatstream-images-v1";
const OFFLINE_URL = "/";

const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const allowed = new Set([CACHE_NAME, AUDIO_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !allowed.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isAudio(url) {
  return /\.(mp3|m4a|aac|webm|ogg)(\?|$)/i.test(url) || url.includes("aac.saavncdn.com");
}

function isImage(url) {
  return /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(url) || url.includes("c.saavncdn.com");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Audio: cache-first (so downloaded songs stay offline)
  if (isAudio(url.href)) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch {
          return new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // Images from saavn CDN: cache-first
  if (isImage(url.href) && url.hostname.includes("saavncdn")) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch {
          return cached || new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // Saavn API: network-first, fall back to cache
  if (url.hostname === "saavn.dev") {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match(event.request).then((c) => c || new Response("{}", { status: 504, headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

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

  // Cache-first for static assets
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
  if (event.data === "skipWaiting") self.skipWaiting();
});
