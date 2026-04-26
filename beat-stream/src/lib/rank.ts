// Multi-signal song ranking. Given a search query and a list of songs from the
// JioSaavn API, return them re-ordered with the most-likely original/canonical
// version first.
//
// Signals (in descending weight):
//   1. Filter junk versions (karaoke, instrumental, remix, lofi, etc) unless
//      the user actually asked for that
//   2. Primary artist name contains the query
//   3. Album name contains the song name (originals usually do)
//   4. Token overlap between query and song name
//   5. log(playCount) — popularity is a strong proxy for "the original"
//   6. Duration in [90s, 600s] — too short = preview, too long = mashup

import type { Song } from "./types";

const JUNK_TOKENS = ["karaoke", "instrumental", "lofi", "lo-fi", "remix", "cover", "version", "reprise", "slowed", "reverb", "8d", "live", "acoustic", "unplugged", "mashup"];

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] { return normalize(s).split(" ").filter((t) => t.length > 1); }

export function scoreSong(song: Song, query: string): number {
  const q = normalize(query);
  const qTokens = tokens(query);
  const askedJunk = JUNK_TOKENS.some((j) => q.includes(j));

  const name = normalize(song.name);
  const album = normalize(song.album?.name || "");
  const artists = (song.artists?.primary || []).map((a) => normalize(a.name)).join(" ");
  const dur = typeof song.duration === "string" ? parseInt(song.duration, 10) : (song.duration || 0);
  const plays = (song as any).playCount || 0;

  let score = 0;

  // Junk filter: if user didn't ask for it, push these way down
  if (!askedJunk) {
    for (const j of JUNK_TOKENS) {
      if (name.includes(j) || album.includes(j)) score -= 100;
    }
  }

  // Token overlap with song name
  let nameMatch = 0;
  for (const t of qTokens) if (name.includes(t)) nameMatch++;
  score += nameMatch * 30;
  // Big bonus for exact-name match
  if (name === q) score += 200;
  // Substring match
  if (name.includes(q) || q.includes(name)) score += 80;

  // Artist name match (any token in query matches artist)
  let artistMatch = 0;
  for (const t of qTokens) if (artists.includes(t)) artistMatch++;
  score += artistMatch * 25;

  // Album-name match: originals are usually on an album of the same name
  for (const t of qTokens) if (album.includes(t)) score += 8;
  if (album && name && album.includes(name)) score += 20;

  // Popularity (log-scaled — 1M plays = +60, 10M = +70)
  if (plays > 0) score += Math.log10(plays + 1) * 10;

  // Duration sanity: real songs usually 90s-600s. Punish too-short = preview.
  if (dur > 0 && dur < 60) score -= 80;
  if (dur >= 90 && dur <= 600) score += 5;

  // Verified primary artist (has image url) — hand-uploaded covers often miss this
  if (song.artists?.primary?.[0]?.image && (song.artists.primary[0].image as any).length > 0) score += 5;

  return score;
}

export function rankSongs(songs: Song[], query: string): Song[] {
  // De-dupe by normalized name + primary artist (keep best score per key)
  const map = new Map<string, { song: Song; score: number }>();
  for (const s of songs) {
    const score = scoreSong(s, query);
    const key = `${normalize(s.name)}::${normalize(s.artists?.primary?.[0]?.name || "")}`;
    const ex = map.get(key);
    if (!ex || score > ex.score) map.set(key, { song: s, score });
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score).map((x) => x.song);
}
