// Build a list of songs related to a given song.
//
// Strategy (in order, fall through if previous yields too few):
//   1. Saavn /api/songs/{id}/suggestions  (true recommendations if mirror has it)
//   2. Other top songs by the same primary artist
//   3. Songs from the same album
//   4. Search "<song name>" then "<artist name>" and merge
//
// All results are ranked by [rank.ts] using the original song's name+artist as
// the query (so closest matches surface first), deduped, and the source song
// is excluded.

import { api } from "./api";
import type { Song } from "./types";
import { rankSongs } from "./rank";
import { cached, TTL } from "./cache";

export async function buildRelatedQueue(song: Song, want = 20): Promise<Song[]> {
  const cacheKey = `related:${song.id}`;
  return cached(cacheKey, TTL.daylist, () => doBuild(song, want));
}

async function doBuild(song: Song, want: number): Promise<Song[]> {
  const out: Song[] = [];
  const seen = new Set<string>([song.id]);
  const push = (s?: Song) => { if (s && !seen.has(s.id)) { seen.add(s.id); out.push(s); } };

  // 1. Try saavn suggestions endpoint
  try {
    const sug = await api.getSongSuggestions(song.id, 30);
    sug.forEach(push);
  } catch {}

  // 2. Same primary artist's top songs
  if (out.length < want && song.artists?.primary?.[0]?.id) {
    try {
      const r = await api.getArtistSongs(song.artists.primary[0].id, 0);
      r.songs.forEach(push);
    } catch {}
  }

  // 3. Same album's other songs
  if (out.length < want && song.album?.id) {
    try {
      const a = await api.getAlbum(song.album.id);
      (a.songs || []).forEach(push);
    } catch {}
  }

  // 4. Search by song name and merge with artist search
  if (out.length < want) {
    const query = song.name + " " + (song.artists?.primary?.[0]?.name || "");
    try {
      const r = await api.searchSongs(query, 0, 25);
      r.results.forEach(push);
    } catch {}
  }

  // Final ranking — use song name + artist as the query so the most similar
  // tracks float to the top (and remixes/karaoke get pushed down).
  const refQuery = `${song.name} ${song.artists?.primary?.[0]?.name || ""}`.trim();
  return rankSongs(out, refQuery).slice(0, want);
}
