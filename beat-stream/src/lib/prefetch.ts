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
import type { Song, Quality } from "./types";
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
  /** Warm the browser's HTTP cache with the FULL audio file. Heavy. */
  audio(song: Song, quality: any) {
    const url = pickDownloadUrl(song, quality);
    if (!url || inflight.has(`au:${url}`)) return;
    inflight.add(`au:${url}`);
    enqueue(`au:${url}`, () => fetch(url, { method: "GET", mode: "cors" }).then(() => undefined).catch(() => undefined));
  },
  /**
   * Fetch only the FIRST chunk of the audio file (1.5 MB ≈ 30-40 s at 320 kbps).
   * The browser caches this chunk; when the audio element later requests this
   * URL, the start plays instantly from cache while the rest streams normally.
   *
   * Way lighter than `audio()` — perfect for warming the next 5-6 queue items.
   */
  audioStart(url: string) {
    if (!url || inflight.has(`au-start:${url}`)) return;
    inflight.add(`au-start:${url}`);
    enqueue(`au-start:${url}`, () =>
      fetch(url, { headers: { Range: "bytes=0-1572863" }, mode: "cors", cache: "force-cache" })
        .then(() => undefined)
        .catch(() => undefined)
    );
  },
  /** Combo: fetch song metadata (so we have downloadUrl), then fetch first chunk. */
  songAndAudioStart(songId: string, quality: Quality) {
    enqueue(`song-warmed:${songId}`, async () => {
      try {
        const data = await cached<Song[]>(`song:${songId}`, TTL.song, () => api.getSong(songId));
        const full = Array.isArray(data) ? data[0] : (data as any);
        if (!full?.downloadUrl?.length) return;
        const url = pickDownloadUrl(full, quality);
        if (url) {
          await fetch(url, { headers: { Range: "bytes=0-1572863" }, mode: "cors", cache: "force-cache" }).catch(() => {});
        }
      } catch {}
    });
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
