// Smart song search.
//
// JioSaavn's /api/search/songs is sensitive to query phrasing — "tum hi ho
// arijit" can return junk while "tum hi ho" returns the original. Some queries
// only surface the song you want via the global /api/search topQuery.
//
// We fan out a few query variants in parallel, merge the results, dedupe, and
// hand off to the multi-signal ranker. Results are cached at the *bundle*
// level so repeat searches hit zero network.

import { api } from "./api";
import type { Song, Album, Artist, Playlist } from "./types";
import { rankSongs } from "./rank";
import { cached, TTL } from "./cache";

export interface SearchBundle {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  topQuery: { id: string; title: string; type: string }[];
}

function variants(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const out = new Set<string>([q]);
  // Drop stopwords/articles so "the weeknd" also tries "weeknd"
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    out.add(tokens.slice(0, Math.min(3, tokens.length)).join(" "));
  }
  // Strip leading "the/a/an"
  if (/^(the|a|an)\s+/i.test(q)) out.add(q.replace(/^(the|a|an)\s+/i, ""));
  // Bollywood lyric searches often work better lower-cased & punctuation-free
  out.add(q.toLowerCase().replace(/[^\w\s]/g, "").trim());
  return Array.from(out).filter(Boolean);
}

async function safeSearchSongs(q: string): Promise<Song[]> {
  try {
    const r = await api.searchSongs(q, 0, 30);
    return r.results || [];
  } catch { return []; }
}
async function safeSearchAlbums(q: string): Promise<Album[]> {
  try { return (await api.searchAlbums(q, 0, 12)).results || []; } catch { return []; }
}
async function safeSearchArtists(q: string): Promise<Artist[]> {
  try { return (await api.searchArtists(q, 0, 12)).results || []; } catch { return []; }
}
async function safeSearchPlaylists(q: string): Promise<Playlist[]> {
  try { return (await api.searchPlaylists(q, 0, 12)).results || []; } catch { return []; }
}
async function safeGlobal(q: string) {
  try { return await api.searchAll(q); } catch { return null; }
}

export async function smartSearch(query: string): Promise<SearchBundle> {
  return cached(`smart-search:${query.toLowerCase()}`, TTL.search, () => doSmartSearch(query));
}

async function doSmartSearch(query: string): Promise<SearchBundle> {
  const vs = variants(query);

  // Run all variants in parallel — but bound it to 3 to keep it polite
  const variantPromises = vs.slice(0, 3).map(safeSearchSongs);
  const [primaryAlbums, primaryArtists, primaryPlaylists, global, ...allSongLists] = await Promise.all([
    safeSearchAlbums(query),
    safeSearchArtists(query),
    safeSearchPlaylists(query),
    safeGlobal(query),
    ...variantPromises,
  ]);

  // Merge song results (dedupe by id)
  const songMap = new Map<string, Song>();
  for (const list of allSongLists) for (const s of list) songMap.set(s.id, s);
  // Add global topQuery songs (they're the canonical match per saavn)
  if (global?.songs?.results) for (const s of global.songs.results) if (!songMap.has(s.id)) songMap.set(s.id, s);

  const merged = Array.from(songMap.values());
  const songs = rankSongs(merged, query);

  return {
    songs,
    albums: primaryAlbums,
    artists: primaryArtists,
    playlists: primaryPlaylists,
    topQuery: global?.topQuery?.results?.map((r: any) => ({ id: r.id, title: r.title, type: r.type })) || [],
  };
}
