import type { Album, Artist, Playlist, Song } from "./types";
import { getLrcLibLyrics, getLrcLibPlainText } from "./lrclib";

// Multiple mirrors of the same JioSaavn API. We try them in order and
// remember which one is currently working so subsequent calls are fast.
// All mirrors share the exact same response shape.
const HOSTS = [
  "https://saavn.dev",
  "https://saavn-api-eight.vercel.app",
  "https://saavn.me",
];

// Aggressive defaults: most JioSaavn calls return in <500ms when reachable.
// 4s lets us bail and try the next mirror fast instead of stalling 30s on a
// dead host (the previous 10s × 3 mirrors = 30s killed search performance).
const TIMEOUT = 4_000;
const TTL = 5 * 60 * 1000;
const HOST_KEY = "bs-api-host";
// Cooldown for hosts that just failed: skip them entirely for this many ms so
// repeat searches don't try a known-dead mirror over and over.
const HOST_FAIL_COOLDOWN = 60_000;

const memCache = new Map<string, { data: unknown; ts: number }>();
const hostFailedAt = new Map<string, number>();

function preferredHost(): string {
  if (typeof window === "undefined") return HOSTS[0];
  try {
    const saved = localStorage.getItem(HOST_KEY);
    if (saved && HOSTS.includes(saved)) return saved;
  } catch {}
  return HOSTS[0];
}

function rememberHost(h: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(HOST_KEY, h); } catch {}
}

interface ApiResponse<T> { success: boolean; data: T; }

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function tryHost<T>(host: string, path: string): Promise<T> {
  const res = await fetchWithTimeout(`${host}${path}`, TIMEOUT);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json || (json.success === false && !json.data)) throw new Error("API empty");
  return json.data;
}

async function get<T>(path: string): Promise<T> {
  const cached = memCache.get(path);
  if (cached && Date.now() - cached.ts < TTL) return cached.data as T;

  // Order hosts: preferred first, then the rest. Skip hosts that recently
  // failed unless ALL hosts are in cooldown (then we have to try anyway).
  const preferred = preferredHost();
  const now = Date.now();
  let ordered = [preferred, ...HOSTS.filter((h) => h !== preferred)];
  const filtered = ordered.filter((h) => (now - (hostFailedAt.get(h) || 0)) > HOST_FAIL_COOLDOWN);
  if (filtered.length) ordered = filtered;

  let lastErr: unknown;
  for (const host of ordered) {
    try {
      const data = await tryHost<T>(host, path);
      memCache.set(path, { data, ts: Date.now() });
      hostFailedAt.delete(host);
      if (host !== preferred) rememberHost(host);
      return data;
    } catch (e) {
      lastErr = e;
      hostFailedAt.set(host, Date.now());
    }
  }
  throw lastErr;
}

export interface SearchResult<T> { total: number; start: number; results: T[]; }
export interface GlobalSearchResult {
  topQuery?: { results: { id: string; title: string; type: string; image?: { quality: string; url: string }[] }[] };
  songs?: { results: Song[] };
  albums?: { results: Album[] };
  artists?: { results: Artist[] };
  playlists?: { results: Playlist[] };
}

export const api = {
  searchSongs: (q: string, page = 0, limit = 20) =>
    get<SearchResult<Song>>(`/api/search/songs?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  searchAlbums: (q: string, page = 0, limit = 20) =>
    get<SearchResult<Album>>(`/api/search/albums?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  searchArtists: (q: string, page = 0, limit = 20) =>
    get<SearchResult<Artist>>(`/api/search/artists?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  searchPlaylists: (q: string, page = 0, limit = 20) =>
    get<SearchResult<Playlist>>(`/api/search/playlists?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  searchAll: (q: string) => get<GlobalSearchResult>(`/api/search?query=${encodeURIComponent(q)}`),
  getSong: (id: string) => get<Song[]>(`/api/songs/${id}`),
  getAlbum: (id: string) => get<Album>(`/api/albums?id=${id}`),
  getPlaylist: (id: string, page = 0, limit = 100) =>
    get<Playlist>(`/api/playlists?id=${id}&page=${page}&limit=${limit}`),
  getArtist: (id: string) => get<Artist>(`/api/artists/${id}`),
  getArtistSongs: (id: string, page = 0, sortBy = "popularity", sortOrder = "desc") =>
    get<{ total: number; songs: Song[] }>(`/api/artists/${id}/songs?page=${page}&sortBy=${sortBy}&sortOrder=${sortOrder}`),
  getArtistAlbums: (id: string, page = 0, sortBy = "popularity", sortOrder = "desc") =>
    get<{ total: number; albums: Album[] }>(`/api/artists/${id}/albums?page=${page}&sortBy=${sortBy}&sortOrder=${sortOrder}`),
  getLyrics: async (id: string): Promise<string | null> => {
    try {
      const data = await get<{ lyrics: string; snippet?: string; copyright?: string }>(
        `/api/songs/${id}/lyrics`
      );
      return data.lyrics || null;
    } catch { return null; }
  },
  /**
   * Lyrics for a full Song object. Tries JioSaavn first (only meaningful for
   * `source: "saavn"` songs since YouTube ids aren't in Saavn's index), then
   * falls through to LRCLIB which has a much wider catalog of synced lyrics.
   */
  getLyricsForSong: async (song: Song): Promise<string | null> => {
    if (song.source !== "youtube") {
      try {
        const data = await get<{ lyrics: string; snippet?: string; copyright?: string }>(
          `/api/songs/${song.id}/lyrics`
        );
        if (data.lyrics) return data.lyrics;
      } catch {}
    }
    const artist = song.artists?.primary?.[0]?.name;
    if (!artist || !song.name) return null;
    const dur = typeof song.duration === "string" ? parseInt(song.duration, 10) : song.duration;
    return getLrcLibPlainText(artist, song.name, song.album?.name, dur || undefined);
  },
  /**
   * Like getLyricsForSong but also returns synced LRC if available so the
   * UI can highlight the current line and auto-scroll. Saavn's lyrics
   * endpoint returns HTML/plain only, so for synced lyrics we always go to
   * LRCLIB. We still try Saavn first to get a plain fallback, then enrich
   * with LRCLIB when present.
   */
  getSyncedLyricsForSong: async (song: Song): Promise<{ plain: string | null; synced: string | null }> => {
    let plain: string | null = null;
    if (song.source !== "youtube") {
      try {
        const data = await get<{ lyrics: string }>(`/api/songs/${song.id}/lyrics`);
        if (data.lyrics) plain = data.lyrics;
      } catch {}
    }
    const artist = song.artists?.primary?.[0]?.name;
    if (artist && song.name) {
      const dur = typeof song.duration === "string" ? parseInt(song.duration, 10) : song.duration;
      const lrc = await getLrcLibLyrics(artist, song.name, song.album?.name, dur || undefined);
      if (lrc) {
        return {
          plain: plain || lrc.plain,
          synced: lrc.synced,
        };
      }
    }
    return { plain, synced: null };
  },
  // Some saavn.dev mirrors expose a `/suggestions` endpoint for songs. We try
  // it and treat any failure as "not available" — the recommender falls back
  // to artist-based search.
  getSongSuggestions: async (id: string, limit = 20): Promise<Song[]> => {
    try {
      const data = await get<Song[]>(`/api/songs/${id}/suggestions?limit=${limit}`);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
};

export const API_HOSTS = HOSTS;
export function setApiHost(host: string) { rememberHost(host); memCache.clear(); }
export function getApiHost(): string { return preferredHost(); }
