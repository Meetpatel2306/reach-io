import type { Album, Artist, Playlist, Song } from "./types";

const BASE = "https://saavn.dev";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as ApiResponse<T>;
  return json.data;
}

export interface SearchSongsResult {
  total: number;
  start: number;
  results: Song[];
}

export interface SearchAlbumsResult {
  total: number;
  start: number;
  results: Album[];
}

export interface SearchArtistsResult {
  total: number;
  start: number;
  results: Artist[];
}

export interface SearchPlaylistsResult {
  total: number;
  start: number;
  results: Playlist[];
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
    get<SearchSongsResult>(`/api/search/songs?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),

  searchAlbums: (q: string, page = 0, limit = 20) =>
    get<SearchAlbumsResult>(`/api/search/albums?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),

  searchArtists: (q: string, page = 0, limit = 20) =>
    get<SearchArtistsResult>(`/api/search/artists?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),

  searchPlaylists: (q: string, page = 0, limit = 20) =>
    get<SearchPlaylistsResult>(`/api/search/playlists?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),

  searchAll: (q: string) => get<GlobalSearchResult>(`/api/search?query=${encodeURIComponent(q)}`),

  getSong: (id: string) => get<Song[]>(`/api/songs/${id}`),

  getSongs: (ids: string[]) => get<Song[]>(`/api/songs?ids=${ids.join(",")}`),

  getAlbum: (id: string) => get<Album>(`/api/albums?id=${id}`),

  getPlaylist: (id: string, page = 0, limit = 50) =>
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
