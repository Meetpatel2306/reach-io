// Build a "song radio"-style queue of songs related to the current one.
//
// Philosophy: different song, same mood — like Spotify Radio.
// You just heard "Tum Hi Ho" by Arijit Singh? You want OTHER great Hindi
// romantic songs, with a few more Arijit tracks sprinkled in. You do NOT want
// 5 cover versions of "Tum Hi Ho" by random uploaders.
//
// Strategy:
//   1. Saavn suggestions endpoint (true recommendations, when available)
//   2. Other top songs by the SAME primary artist (max ~6, so we don't lock
//      into one artist for a 25-song queue)
//   3. Trending in the same language (mood proxy — language is a strong signal
//      for Bollywood vs English vs regional)
//   4. Songs by featured / collaborating artists (broadens variety)
//
// Hard filters at every step:
//   - Same id as the source song → out
//   - Same normalized song name → out (kills cover/instrumental/karaoke versions)
//   - Tagged karaoke / instrumental / lofi / remix in name → out
//   - Duration < 60s → out (snippets/previews)
//
// Final ranking uses song-name + language + (NOT exact name match) as signals
// so similar-vibe tracks float to the top without exact-name duplicates.

import { api } from "./api";
import type { Song } from "./types";
import { cached, TTL } from "./cache";

const JUNK_TOKENS = ["karaoke", "instrumental", "lofi", "lo-fi", "remix", "cover", "version", "reprise", "slowed", "reverb", "8d", "live"];

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isJunkVersion(name: string): boolean {
  const n = normalize(name);
  return JUNK_TOKENS.some((j) => n.includes(j));
}

function durationSec(s: Song): number {
  return typeof s.duration === "string" ? parseInt(s.duration, 10) : (s.duration || 0);
}

export async function buildRelatedQueue(song: Song, want = 25): Promise<Song[]> {
  return cached(`related:${song.id}`, TTL.daylist, () => doBuild(song, want));
}

async function doBuild(song: Song, want: number): Promise<Song[]> {
  const sourceName = normalize(song.name);
  const language = (song.language || "").toLowerCase();
  const out: Song[] = [];
  const seen = new Set<string>([song.id]);
  // Also dedupe by normalized name + primary artist so two slightly different
  // uploads of the same song collapse to one entry.
  const seenKeys = new Set<string>();

  function admit(s: Song): boolean {
    if (!s?.id || seen.has(s.id)) return false;
    const n = normalize(s.name);
    // Drop covers / karaoke / instrumental / etc.
    if (isJunkVersion(s.name)) return false;
    // Drop exact-name duplicates of the source song
    if (n === sourceName) return false;
    // Drop very short clips
    if (durationSec(s) > 0 && durationSec(s) < 60) return false;
    const key = `${n}::${normalize(s.artists?.primary?.[0]?.name || "")}`;
    if (seenKeys.has(key)) return false;
    seen.add(s.id);
    seenKeys.add(key);
    return true;
  }

  function pushAll(arr: Song[] | undefined, limit?: number) {
    if (!arr) return;
    let count = 0;
    for (const s of arr) {
      if (admit(s)) {
        out.push(s);
        count++;
        if (limit && count >= limit) return;
      }
    }
  }

  // 1. Saavn suggestions (best when available — they're context-aware)
  try {
    const sug = await api.getSongSuggestions(song.id, 30);
    pushAll(sug);
  } catch {}

  // 2. Same primary artist — capped at 6 so we don't lock into one artist
  if (out.length < want && song.artists?.primary?.[0]?.id) {
    try {
      const r = await api.getArtistSongs(song.artists.primary[0].id, 0);
      pushAll(r.songs, 6);
    } catch {}
  }

  // 3. Mood proxy via language: "top hindi songs", "trending punjabi", etc.
  if (out.length < want && language) {
    const moodQueries = [
      `top ${language} romantic`,
      `${language} hits`,
      `trending ${language}`,
    ];
    for (const q of moodQueries) {
      if (out.length >= want) break;
      try {
        const r = await api.searchSongs(q, 0, 15);
        pushAll(r.results);
      } catch {}
    }
  }

  // 4. Featured artists' top songs (broadens variety)
  if (out.length < want && song.artists?.featured?.length) {
    for (const a of song.artists.featured.slice(0, 2)) {
      if (out.length >= want) break;
      try {
        const r = await api.getArtistSongs(a.id, 0);
        pushAll(r.songs, 4);
      } catch {}
    }
  }

  // Light shuffle of the tail so consecutive plays don't always feel identical,
  // but keep the first ~5 (best matches) stable.
  const top = out.slice(0, 5);
  const rest = out.slice(5);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [...top, ...rest].slice(0, want);
}
