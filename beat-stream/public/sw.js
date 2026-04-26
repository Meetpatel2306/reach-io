const CACHE_NAME = "beatstream-v22";
const API_CACHE = "beatstream-api-v3";
const IMAGE_CACHE = "beatstream-images-v3";
const OFFLINE_URL = "/";
const API_TTL = 60 * 60 * 1000; // 1 hour

const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const allowed = new Set([CACHE_NAME, API_CACHE, IMAGE_CACHE]);
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
const API_HOSTS = ["saavn.dev", "saavn-api-eight.vercel.app", "saavn.me"];
function isApi(url) { return API_HOSTS.includes(url.hostname); }

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // NEVER cache audio in SW — handled by IndexedDB in app code
  if (isAudio(url.href)) return;

  // JioSaavn images: cache-first forever
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

  // JioSaavn API: stale-while-revalidate (1 hour)
  if (isApi(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      const cached = await cache.match(event.request);
      const fetchAndCache = fetch(event.request).then((resp) => {
        if (resp.ok) {
          const wrapped = new Response(resp.clone().body, {
            status: resp.status,
            headers: { ...Object.fromEntries(resp.headers.entries()), "x-cached-at": String(Date.now()) },
          });
          cache.put(event.request, wrapped);
        }
        return resp;
      }).catch(() => null);

      if (cached) {
        const cachedAt = parseInt(cached.headers.get("x-cached-at") || "0", 10);
        const fresh = Date.now() - cachedAt < API_TTL;
        if (fresh) return cached;
        // stale: return cached but revalidate in background
        fetchAndCache;
        return cached;
      }
      const live = await fetchAndCache;
      return live || new Response("{}", { status: 504, headers: { "Content-Type": "application/json" } });
    })());
    return;
  }

  // Network-first for navigation
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
