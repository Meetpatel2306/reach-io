import type { Album, Artist, Playlist, Song } from "./types";

const BASE = "https://saavn.dev";
const TIMEOUT = 10_000;
const TTL = 5 * 60 * 1000;

const memCache = new Map<string, { data: unknown; ts: number }>();

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

async function get<T>(path: string): Promise<T> {
  const cached = memCache.get(path);
  if (cached && Date.now() - cached.ts < TTL) return cached.data as T;
  const url = `${BASE}${path}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, TIMEOUT);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as ApiResponse<T>;
      memCache.set(path, { data: json.data, ts: Date.now() });
      return json.data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export interface SearchResult<T> {
  total: number;
  start: number;
  results: T[];
}

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
    } catch {
      return null;
    }
  },
};
