// YouTube Music client via public Piped instances.
//
// Why Piped: it exposes a CORS-friendly REST API over YouTube/YouTube Music,
// so the browser can search and resolve audio stream URLs without a backend.
// Multiple public instances exist; we race them, remember the fastest, and
// fall through automatically when one is rate-limiting or down.
//
// Returned Song objects look identical to JioSaavn's shape so the rest of the
// app (player, queue, ranking) works without branching. The synthesized
// downloadUrl[] points at the Piped-proxied audio stream so the <audio>
// element can play it cross-origin without CORS or HTTPS-mixed-content issues.

import type { Song } from "./types";

// Public Piped instances with CORS enabled. Order = priority. We promote the
// first one that succeeds for the session.
const PIPED_HOSTS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.reallyaweso.me",
];

const TIMEOUT = 8_000;
const HOST_KEY = "bs-piped-host";

function preferredHost(): string {
  if (typeof window === "undefined") return PIPED_HOSTS[0];
  try {
    const saved = localStorage.getItem(HOST_KEY);
    if (saved && PIPED_HOSTS.includes(saved)) return saved;
  } catch {}
  return PIPED_HOSTS[0];
}

function rememberHost(h: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(HOST_KEY, h); } catch {}
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function tryHosts<T>(path: string): Promise<T> {
  const preferred = preferredHost();
  const ordered = [preferred, ...PIPED_HOSTS.filter((h) => h !== preferred)];
  let lastErr: unknown;
  for (const host of ordered) {
    try {
      const res = await fetchWithTimeout(`${host}${path}`, TIMEOUT);
      if (!res.ok) throw new Error(`piped ${res.status}`);
      const json = (await res.json()) as T;
      if (host !== preferred) rememberHost(host);
      return json;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

interface PipedSearchItem {
  url: string;            // "/watch?v=..." or "/channel/..."
  type: string;           // "stream" | "channel" | "playlist"
  title?: string;
  thumbnail?: string;
  uploaderName?: string;
  uploaderUrl?: string;
  uploaderAvatar?: string;
  duration?: number;      // seconds, -1 for live
  views?: number;
  uploaded?: number;
  uploadedDate?: string;
  isShort?: boolean;
}

interface PipedSearchResponse {
  items: PipedSearchItem[];
  nextpage?: string | null;
  suggestion?: string | null;
}

interface PipedAudioStream {
  url: string;
  format: string;        // "M4A" | "WEBMA" | etc.
  quality: string;       // "128 kbps" | "256 kbps" | ...
  mimeType: string;      // "audio/mp4; codecs=..."
  codec?: string;
  bitrate?: number;      // bits per second
  videoOnly?: boolean;
  audioTrackName?: string | null;
  audioTrackType?: string | null;
}

interface PipedStreamsResponse {
  title?: string;
  uploader?: string;
  uploaderUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  audioStreams?: PipedAudioStream[];
  videoStreams?: unknown[];
}

function videoIdFromUrl(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?&]v=([\w-]{6,})/) || url.match(/\/watch\/([\w-]{6,})/);
  return m?.[1] ?? null;
}

function songIdForYt(videoId: string): string {
  return `yt:${videoId}`;
}

function bestThumbnail(thumb: string | undefined): string | undefined {
  if (!thumb) return undefined;
  // YouTube returns a thumb URL like .../hqdefault.jpg?... — swap to maxres.
  return thumb.replace(/\/[a-z0-9_]+\.(jpg|webp)/, "/maxresdefault.$1");
}

function buildSongFromSearch(item: PipedSearchItem): Song | null {
  const id = videoIdFromUrl(item.url);
  if (!id) return null;
  const thumb = bestThumbnail(item.thumbnail);
  const dur = item.duration && item.duration > 0 ? item.duration : 0;
  return {
    id: songIdForYt(id),
    name: (item.title || "").replace(/\s*\(Official.*?\)\s*/i, "").trim() || (item.title || ""),
    type: "song",
    duration: dur,
    language: "english",
    source: "youtube",
    ytId: id,
    artists: {
      primary: item.uploaderName ? [{ id: item.uploaderUrl?.split("/").pop() || item.uploaderName, name: item.uploaderName.replace(/\s*-\s*Topic$/, "").trim() }] : [],
    },
    image: thumb ? [
      { quality: "50x50", url: thumb },
      { quality: "150x150", url: thumb },
      { quality: "500x500", url: thumb },
    ] : [],
    // downloadUrl gets populated lazily via resolveYtStreamUrl. Until then the
    // player will refetch via ensureFullSong.
    downloadUrl: [],
  };
}

/** Search YouTube Music via Piped. Filter favors music tracks. */
export async function ytSearchSongs(query: string, limit = 20): Promise<Song[]> {
  const q = encodeURIComponent(query);
  // music_songs filter biases toward actual music; music_videos works too.
  // If the dedicated music filter returns nothing, fall back to plain video search.
  let items: PipedSearchItem[] = [];
  try {
    const r = await tryHosts<PipedSearchResponse>(`/search?q=${q}&filter=music_songs`);
    items = r.items || [];
  } catch {}
  if (!items.length) {
    try {
      const r = await tryHosts<PipedSearchResponse>(`/search?q=${q}&filter=videos`);
      items = (r.items || []).filter((i) => i.type === "stream");
    } catch {}
  }
  const songs: Song[] = [];
  for (const it of items.slice(0, limit)) {
    const s = buildSongFromSearch(it);
    if (s) songs.push(s);
  }
  return songs;
}

/** Resolve the highest-bitrate audio stream URL for a YouTube video id. */
export async function resolveYtStreamUrl(videoId: string): Promise<string | null> {
  try {
    const r = await tryHosts<PipedStreamsResponse>(`/streams/${videoId}`);
    const streams = (r.audioStreams || []).filter((s) => !s.videoOnly && s.url);
    if (!streams.length) return null;
    streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    return streams[0].url;
  } catch {
    return null;
  }
}

/**
 * Take a partially-built YouTube Song (no downloadUrl yet) and fill in a
 * working stream URL. Called by the player's ensureFullSong path.
 */
export async function hydrateYtSong(song: Song): Promise<Song> {
  if (song.source !== "youtube" || !song.ytId) return song;
  if (song.downloadUrl?.length) return song;
  const url = await resolveYtStreamUrl(song.ytId);
  if (!url) return song;
  return {
    ...song,
    downloadUrl: [
      { quality: "160kbps", url },
    ],
  };
}

export const PIPED_INSTANCES = PIPED_HOSTS;
export function getPipedHost(): string { return preferredHost(); }
export function setPipedHost(h: string) { rememberHost(h); }
