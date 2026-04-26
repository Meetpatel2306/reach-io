// Two-phase search.
//
// Phase 1 — `smartSearchFast(query)` runs only the 4 cheap Saavn endpoints
// (songs, albums, artists, playlists) in parallel. Returns in ~200ms when the
// API is healthy. The search page renders these results immediately.
//
// Phase 2 — `enrichSearch(query, onUpdate)` runs the expensive optional
// sources (LRCLIB lyric matching, album-expansion, YouTube fallback) and
// streams matches back via callback so the UI can append without blocking.
//
// Why split? Promise.all() waits for the slowest call. If one mirror is
// down or YouTube is slow, a single search can take 30-60s. Splitting lets
// us show useful results in <0.5s even when the slow stuff is timing out.

import { api } from "./api";
import type { Song, Album, Artist, Playlist } from "./types";
import { rankSongs } from "./rank";
import { cached, peek, TTL } from "./cache";
import { ytSearchSongs } from "./youtubeMusic";
import { searchByLyric } from "./lyricSearch";
import { fuzzyVariants, editDistance } from "./fuzzy";

export interface SearchBundle {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  topQuery: { id: string; title: string; type: string }[];
  lyricFound: string[];
  /** Suggestion when fuzzy artist match differs from the user's query. */
  didYouMean?: { name: string; query: string };
}

function variants(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const out = new Set<string>([q]);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) out.add(tokens.slice(0, Math.min(3, tokens.length)).join(" "));
  if (/^(the|a|an)\s+/i.test(q)) out.add(q.replace(/^(the|a|an)\s+/i, ""));
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

/** Phase 1: fast, 4 parallel calls to Saavn. Returns in ~200ms when healthy. */
export async function smartSearchFast(query: string): Promise<SearchBundle> {
  return cached(`smart-fast:${query.toLowerCase()}`, TTL.search, () => doFast(query));
}

async function doFast(query: string): Promise<SearchBundle> {
  // Try ONLY the primary query first, in parallel. Variants & global topQuery
  // are fired in the background as part of enrichment.
  const [primarySongs, albums, artists, playlists] = await Promise.all([
    safeSearchSongs(query),
    safeSearchAlbums(query),
    safeSearchArtists(query),
    safeSearchPlaylists(query),
  ]);

  const ranked = rankSongs(primarySongs, query);
  return {
    songs: ranked,
    albums,
    artists,
    playlists,
    topQuery: [],
    lyricFound: [],
  };
}

/**
 * Phase 2: optional enrichment. Calls `onUpdate` each time a new source
 * lands so the UI can re-render progressively. Sources that fail or time out
 * just don't produce updates — they never block the UX.
 */
export async function enrichSearch(
  query: string,
  initial: SearchBundle,
  onUpdate: (next: SearchBundle) => void,
): Promise<void> {
  // Snapshot we mutate as enrichment results come in
  let bundle: SearchBundle = { ...initial };

  // 1) Variants — sometimes "tum hi ho arijit" misses but "tum hi ho" hits
  const vs = variants(query).filter((v) => v !== query).slice(0, 2);
  vs.forEach((v) => {
    safeSearchSongs(v).then((extra) => {
      if (!extra.length) return;
      const merged = mergeSongs(bundle.songs, extra);
      bundle = { ...bundle, songs: rankSongs(merged, query) };
      onUpdate(bundle);
    });
  });

  // 1b) Fuzzy / typo variants — only when initial results are thin (<=8 songs)
  // because fuzzying a precise query just adds noise. "ed shreen" → "ed sheeran"
  // is exactly the case this catches.
  if (bundle.songs.length <= 8) {
    const fz = fuzzyVariants(query, 4);
    fz.forEach((v) => {
      safeSearchSongs(v).then((extra) => {
        if (!extra.length) return;
        const merged = mergeSongs(bundle.songs, extra);
        bundle = { ...bundle, songs: rankSongs(merged, query) };
        onUpdate(bundle);
      });
    });
  }

  // 1c) Artist discography expansion — when search returns matching artists,
  // pull their full song list. Massive win for queries like "ed sheeran" where
  // /api/search/songs returns ~5 hits but /api/artists/{id}/songs returns 100+.
  expandTopArtists(bundle.artists, query).then(({ songs, didYouMean }) => {
    if (didYouMean && !bundle.didYouMean) bundle = { ...bundle, didYouMean };
    if (songs.length) {
      const merged = mergeSongs(bundle.songs, songs);
      bundle = { ...bundle, songs: rankSongs(merged, query) };
    }
    onUpdate(bundle);
  });

  // 2) Global topQuery — Saavn's canonical match
  api.searchAll(query).then((g) => {
    if (!g) return;
    if (g.songs?.results) {
      const merged = mergeSongs(bundle.songs, g.songs.results);
      bundle = { ...bundle, songs: rankSongs(merged, query) };
    }
    if (g.topQuery?.results) {
      bundle = { ...bundle, topQuery: g.topQuery.results.map((r: any) => ({ id: r.id, title: r.title, type: r.type })) };
    }
    onUpdate(bundle);
  }).catch(() => {});

  // 3) Album expansion — top album's songs (movie-name searches)
  songsFromAlbumMatches(query).then((extra) => {
    if (!extra.length) return;
    const merged = mergeSongs(bundle.songs, extra);
    bundle = { ...bundle, songs: rankSongs(merged, query) };
    onUpdate(bundle);
  });

  // 4) Lyric matching — only fires for ≥5 char queries
  songsFromLyricMatches(query).then(({ songs, ids }) => {
    if (!songs.length) return;
    const merged = mergeSongs(bundle.songs, songs);
    bundle = {
      ...bundle,
      songs: rankSongs(merged, query),
      lyricFound: Array.from(new Set([...bundle.lyricFound, ...ids])),
    };
    onUpdate(bundle);
  });

  // 5) YouTube fallback — usually catalog filler (Western artists, K-pop,
  // anime). When Saavn's initial results are sparse (<5), we WAIT for YT
  // and ranknew matches inline rather than just appending — so for queries
  // like "ed sheeran" the YT hits float to the top of the list.
  safeYt(query).then((yt) => {
    if (!yt.length) return;
    const haveKeys = new Set(
      bundle.songs.map((s) => `${normKey(s.name)}::${normKey(s.artists?.primary?.[0]?.name)}`),
    );
    const ytFiltered = yt.filter((y) => !haveKeys.has(`${normKey(y.name)}::${normKey(y.artists?.primary?.[0]?.name)}`));
    if (!ytFiltered.length) return;
    const sparse = bundle.songs.length < 5;
    if (sparse) {
      // Inter-rank: mix YT hits into the main list so they get fair placement
      const merged = mergeSongs(bundle.songs, ytFiltered);
      bundle = { ...bundle, songs: rankSongs(merged, query) };
    } else {
      const ranked = rankSongs(ytFiltered, query);
      bundle = { ...bundle, songs: [...bundle.songs, ...ranked] };
    }
    onUpdate(bundle);
  });
}

function normKey(s: string | undefined): string {
  return (s || "").toLowerCase().trim();
}

function mergeSongs(existing: Song[], extra: Song[]): Song[] {
  const ids = new Set(existing.map((s) => s.id));
  const out = existing.slice();
  for (const s of extra) if (!ids.has(s.id)) { ids.add(s.id); out.push(s); }
  return out;
}

async function safeYt(q: string): Promise<Song[]> {
  try { return await ytSearchSongs(q, 20); } catch { return []; }
}

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

async function songsFromLyricMatches(q: string): Promise<{ songs: Song[]; ids: string[] }> {
  if (q.trim().length < 5) return { songs: [], ids: [] };
  try {
    const lyricHits = await searchByLyric(q, 5);
    if (!lyricHits.length) return { songs: [], ids: [] };
    const songs: Song[] = [];
    const ids: string[] = [];
    const results = await Promise.all(
      lyricHits.slice(0, 3).map((h) =>
        api.searchSongs(`${h.trackName} ${h.artistName}`, 0, 3).then((r) => r.results?.[0] || null).catch(() => null)
      )
    );
    for (const s of results) if (s && !ids.includes(s.id)) { songs.push(s); ids.push(s.id); }
    return { songs, ids };
  } catch { return { songs: [], ids: [] }; }
}

/** Synchronous read of a fully-cached bundle. Use to render before any await. */
export function peekSearch(query: string): SearchBundle | null {
  const fast = peek<SearchBundle>(`smart-fast:${query.toLowerCase()}`);
  return fast || null;
}

/**
 * Pull full discographies of the top 1-2 matching artists. This is the magic
 * that makes "ed sheeran" surface dozens of his songs even when the song
 * search itself returns ~5 hits — the artist endpoint has way more coverage.
 *
 * Also detects "did you mean": if the best matching artist's name is far
 * from the user's query (Levenshtein > 1) but still close enough to be
 * the obvious intended target, surface a suggestion.
 */
async function expandTopArtists(
  artists: Artist[],
  query: string,
): Promise<{ songs: Song[]; didYouMean?: { name: string; query: string } }> {
  if (!artists.length) return { songs: [] };

  // Pick the top 2 artists to expand. Score each by edit distance to the query
  // so close fuzzy matches (Ed Sheeran for "ed shreen") are preferred.
  const scored = artists
    .map((a) => ({ artist: a, dist: editDistance((a.name || "").toLowerCase(), query.toLowerCase(), 6) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2);

  // Did-you-mean detection: top match is fuzzy-close but not exact
  let didYouMean: { name: string; query: string } | undefined;
  const top = scored[0];
  if (top && top.dist >= 2 && top.dist <= 4 && top.artist.name.toLowerCase() !== query.toLowerCase()) {
    didYouMean = { name: top.artist.name, query: top.artist.name };
  }

  // Each page returns ~10 songs. Fetch pages 0-4 in parallel per artist (~50
  // songs per artist) so big-name searches like "diljit dosanjh" actually pull
  // the full catalog instead of just the top 10.
  const PAGES = [0, 1, 2, 3, 4];
  const pageGroups = await Promise.all(
    scored.map(async ({ artist }) => {
      const pageResults = await Promise.all(
        PAGES.map((p) =>
          cached(`artist-songs:${artist.id}:${p}`, TTL.artist, () => api.getArtistSongs(artist.id, p))
            .then((r) => r.songs || [])
            .catch(() => [] as Song[])
        )
      );
      return pageResults.flat();
    })
  );
  const songs: Song[] = [];
  const seen = new Set<string>();
  for (const list of pageGroups) for (const s of list) if (!seen.has(s.id)) { seen.add(s.id); songs.push(s); }
  return { songs, didYouMean };
}
