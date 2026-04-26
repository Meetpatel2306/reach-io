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
import { ytSearchSongs } from "./youtubeMusic";

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
async function safeYt(q: string): Promise<Song[]> {
  try { return await ytSearchSongs(q, 20); } catch { return []; }
}

export async function smartSearch(query: string): Promise<SearchBundle> {
  return cached(`smart-search:${query.toLowerCase()}`, TTL.search, () => doSmartSearch(query));
}

async function doSmartSearch(query: string): Promise<SearchBundle> {
  const vs = variants(query);

  // Run all variants in parallel — but bound it to 3 to keep it polite.
  // YouTube Music runs alongside as a second source, so anything Saavn is
  // missing (English chart hits, K-pop, anime, indie) still surfaces.
  const variantPromises = vs.slice(0, 3).map(safeSearchSongs);
  const [primaryAlbums, primaryArtists, primaryPlaylists, global, ytSongs, ...allSongLists] = await Promise.all([
    safeSearchAlbums(query),
    safeSearchArtists(query),
    safeSearchPlaylists(query),
    safeGlobal(query),
    safeYt(query),
    ...variantPromises,
  ]);

  // Merge song results (dedupe by id). Saavn first (better quality + lyrics),
  // then global topQuery, then YouTube Music as the catalog filler.
  const songMap = new Map<string, Song>();
  for (const list of allSongLists) for (const s of list) songMap.set(s.id, s);
  if (global?.songs?.results) for (const s of global.songs.results) if (!songMap.has(s.id)) songMap.set(s.id, s);

  // YouTube songs are kept aside so the ranker can score them on the same
  // signals (name match, artist match, duration sanity) as Saavn songs.
  const merged = Array.from(songMap.values());
  const ranked = rankSongs(merged, query);

  // Append any YouTube hits whose normalized "name + primary artist" key isn't
  // already represented by a Saavn song. Saavn wins on duplicates because its
  // 320kbps audio + lyrics ID are richer than what we get from YouTube.
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
  };
}
