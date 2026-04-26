// Background prefetcher.
//
// Anything the user *might* tap should already be in localStorage by the time
// they tap. We prefetch:
//   • Album/Artist/Playlist detail when its card scrolls into view
//   • The next 3 songs in the queue (full /api/songs/{id} payload)
//   • Album art + audio blob (warmed via a hidden Image() / fetch())
//
// Everything is rate-limited (max N concurrent) and dedupes by key so a card
// that's prefetched once is never re-fetched until its TTL expires.

import { api } from "./api";
import { cached, peek, TTL } from "./cache";
import type { Song } from "./types";
import { pickImage, pickDownloadUrl } from "./utils";

const inflight = new Set<string>();
const MAX_PARALLEL = 3;
const queue: (() => Promise<void>)[] = [];
let running = 0;

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => { running--; pump(); });
  }
}

function enqueue(key: string, job: () => Promise<unknown>) {
  if (inflight.has(key)) return;
  inflight.add(key);
  queue.push(async () => {
    try { await job(); } catch {} finally { inflight.delete(key); }
  });
  pump();
}

export const prefetch = {
  album(id: string) {
    if (peek(`album:${id}`)) return;
    enqueue(`album:${id}`, () => cached(`album:${id}`, TTL.album, () => api.getAlbum(id)));
  },
  artist(id: string) {
    if (peek(`artist:${id}`) || peek(`artist-summary:${id}`)) return;
    enqueue(`artist:${id}`, () => cached(`artist-summary:${id}`, TTL.artist, () => api.getArtist(id)));
  },
  playlist(id: string) {
    if (peek(`playlist:${id}`)) return;
    enqueue(`playlist:${id}`, () => cached(`playlist:${id}`, TTL.playlist, () => api.getPlaylist(id)));
  },
  song(id: string) {
    if (peek(`song:${id}`)) return;
    enqueue(`song:${id}`, () => cached(`song:${id}`, TTL.song, () => api.getSong(id)));
  },
  lyrics(id: string) {
    if (peek(`lyrics:${id}`)) return;
    enqueue(`lyrics:${id}`, () => cached(`lyrics:${id}`, TTL.lyrics, () => api.getLyrics(id)));
  },
  /** Force-load the album art into the browser image cache & SW image cache. */
  image(url: string) {
    if (!url || inflight.has(`img:${url}`)) return;
    inflight.add(`img:${url}`);
    const img = new Image();
    img.onload = img.onerror = () => inflight.delete(`img:${url}`);
    img.src = url;
  },
  /** Warm the SW audio cache for the next track (without storing in IndexedDB). */
  audio(song: Song, quality: any) {
    const url = pickDownloadUrl(song, quality);
    if (!url || inflight.has(`au:${url}`)) return;
    inflight.add(`au:${url}`);
    enqueue(`au:${url}`, () => fetch(url, { method: "GET", mode: "cors" }).then(() => undefined).catch(() => undefined));
  },
};

/** Prefetch helpers that operate on a list of Songs (image + metadata). */
export function prefetchSongs(songs: Song[], n = 3) {
  songs.slice(0, n).forEach((s) => {
    prefetch.image(pickImage(s.image, "med"));
    if (s.album?.id) prefetch.album(s.album.id);
    if (s.artists?.primary?.[0]?.id) prefetch.artist(s.artists.primary[0].id);
  });
}

/** IntersectionObserver-based card prefetch hook. */
import { useEffect, useRef } from "react";

export function usePrefetchOnVisible(fn: () => void, deps: any[] = []) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { fn(); obs.disconnect(); } });
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
