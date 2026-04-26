// Smart song search.
//
// JioSaavn's /api/search/songs is sensitive to query phrasing — "tum hi ho
// arijit" can return junk while "tum hi ho" returns the original. Some queries
// only surface the song you want via the global /api/search topQuery.
//
// We fan out a few query variants in parallel + search albums (so movie names
// surface their tracks) + LRCLIB lyric matching (so a typed lyric snippet
// surfaces the song), merge, dedupe, and hand off to the multi-signal ranker.
// Results are cached at the *bundle* level so repeat searches hit zero network.

import { api } from "./api";
import type { Song, Album, Artist, Playlist } from "./types";
import { rankSongs } from "./rank";
import { cached, TTL } from "./cache";
import { ytSearchSongs } from "./youtubeMusic";
import { searchByLyric } from "./lyricSearch";

export interface SearchBundle {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  topQuery: { id: string; title: string; type: string }[];
  /**
   * Subset of `songs` that were specifically surfaced by lyric search rather
   * than direct title match. Useful so the UI can label them as "Found by
   * lyrics" — these are usually songs the user typed a half-remembered lyric
   * for and didn't expect to surface.
   */
  lyricFound: string[];
}

function variants(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const out = new Set<string>([q]);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    out.add(tokens.slice(0, Math.min(3, tokens.length)).join(" "));
  }
  if (/^(the|a|an)\s+/i.test(q)) out.add(q.replace(/^(the|a|an)\s+/i, ""));
  out.add(q.toLowerCase().replace(/[^\w\s]/g, "").trim());
  return Array.from(out).filter(Boolean);
}

async function safeSearchSongs(q: string): Promise<Song[]> {
  try { return (await api.searchSongs(q, 0, 30)).results || []; } catch { return []; }
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
async function safeYt(q: string): Promise<Song[]> {
  try { return await ytSearchSongs(q, 20); } catch { return []; }
}

/**
 * Look up songs from the top albums returned by a search. Movie/series names
 * usually map to JioSaavn albums; the actual songs (chart-toppers) live inside
 * those album payloads. We fetch up to 3 top albums in parallel and flatten
 * their `.songs` fields.
 */
async function songsFromAlbumMatches(q: string): Promise<Song[]> {
  try {
    const top = (await api.searchAlbums(q, 0, 3)).results || [];
    if (!top.length) return [];
    const albums = await Promise.all(
      top.map((a) =>
        cached(`album:${a.id}`, TTL.album, () => api.getAlbum(a.id)).catch(() => null)
      )
    );
    const out: Song[] = [];
    for (const al of albums) if (al?.songs) out.push(...al.songs);
    return out;
  } catch { return []; }
}

/**
 * Use LRCLIB to find songs whose LYRICS match the query, then re-search each
 * match on Saavn so we get the same Song shape (with downloadUrl etc.).
 * Returns both the resolved Songs and the set of song-ids that came from lyric
 * search (so the UI can label them).
 */
async function songsFromLyricMatches(q: string): Promise<{ songs: Song[]; ids: string[] }> {
  if (q.trim().length < 5) return { songs: [], ids: [] };
  try {
    const lyricHits = await searchByLyric(q, 5);
    if (!lyricHits.length) return { songs: [], ids: [] };
    const songs: Song[] = [];
    const ids: string[] = [];
    // Resolve each lyric hit on Saavn (parallel, but cap to 5)
    const results = await Promise.all(
      lyricHits.slice(0, 5).map((h) =>
        api.searchSongs(`${h.trackName} ${h.artistName}`, 0, 3).then((r) => r.results?.[0] || null).catch(() => null)
      )
    );
    for (const s of results) {
      if (s && !ids.includes(s.id)) { songs.push(s); ids.push(s.id); }
    }
    return { songs, ids };
  } catch { return { songs: [], ids: [] }; }
}

export async function smartSearch(query: string): Promise<SearchBundle> {
  return cached(`smart-search:v2:${query.toLowerCase()}`, TTL.search, () => doSmartSearch(query));
}

async function doSmartSearch(query: string): Promise<SearchBundle> {
  const vs = variants(query);

  const variantPromises = vs.slice(0, 3).map(safeSearchSongs);
  const [
    primaryAlbums,
    primaryArtists,
    primaryPlaylists,
    global,
    ytSongs,
    albumMatchSongs,
    lyricMatch,
    ...allSongLists
  ] = await Promise.all([
    safeSearchAlbums(query),
    safeSearchArtists(query),
    safeSearchPlaylists(query),
    safeGlobal(query),
    safeYt(query),
    songsFromAlbumMatches(query),
    songsFromLyricMatches(query),
    ...variantPromises,
  ]);

  // Merge song results by id. Order matters slightly — earlier sources win
  // when the same song id appears in multiple lists.
  const songMap = new Map<string, Song>();
  for (const list of allSongLists) for (const s of list) if (!songMap.has(s.id)) songMap.set(s.id, s);
  if (global?.songs?.results) for (const s of global.songs.results) if (!songMap.has(s.id)) songMap.set(s.id, s);
  for (const s of albumMatchSongs) if (!songMap.has(s.id)) songMap.set(s.id, s);
  for (const s of lyricMatch.songs) if (!songMap.has(s.id)) songMap.set(s.id, s);

  const merged = Array.from(songMap.values());
  const ranked = rankSongs(merged, query);

  // Append YouTube hits whose normalized name+artist key isn't already represented
  const haveKeys = new Set(
    ranked.map((s) => `${(s.name || "").toLowerCase().trim()}::${(s.artists?.primary?.[0]?.name || "").toLowerCase().trim()}`),
  );
  const ytFiltered: Song[] = [];
  for (const y of ytSongs) {
    const key = `${(y.name || "").toLowerCase().trim()}::${(y.artists?.primary?.[0]?.name || "").toLowerCase().trim()}`;
    if (!haveKeys.has(key)) {
      haveKeys.add(key);
      ytFiltered.push(y);
    }
  }
  const ytRanked = rankSongs(ytFiltered, query);

  return {
    songs: [...ranked, ...ytRanked],
    albums: primaryAlbums,
    artists: primaryArtists,
    playlists: primaryPlaylists,
    topQuery: global?.topQuery?.results?.map((r: any) => ({ id: r.id, title: r.title, type: r.type })) || [],
    lyricFound: lyricMatch.ids,
  };
}
