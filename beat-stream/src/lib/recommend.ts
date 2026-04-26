// Recommendation engine.
//
// Pure-frontend: everything is computed from localStorage (counts, history,
// recently played) plus the song metadata cache. No external recommender model.
//
// What this powers on the home page:
//   • Daily Mix 1-6   — taste clusters by primary-artist + language; each cluster
//                       becomes its own infinite mix
//   • On Repeat       — songs you've replayed 3+ times in the last 30 days
//   • Repeat Rewind   — songs you LOVED >60 days ago but haven't played recently
//   • Time Capsule    — what you were playing this week last year
//   • Because you played X — explainer card linking a recommendation back
//                            to the song that produced it
//
// Plus a Smart Shuffle helper used by the player when shuffle mode is on, so
// shuffles never repeat a recently-played track and lean toward liked songs.

import type { Song } from "./types";
import { counts, history, recent, songCache, liked, listenTime } from "./storage";

const DAY = 24 * 60 * 60 * 1000;

interface Cluster {
  key: string;          // e.g. "arijit singh::hindi"
  artistName: string;
  artistId: string;
  language: string;
  totalPlays: number;
  topSong: Song;        // most-played song in this cluster (for art + label)
  songs: Song[];        // all songs from cache that belong to this cluster
}

function normalize(s: string | undefined): string {
  return (s || "").toLowerCase().trim();
}

/** Build taste clusters from play counts. */
export function getClusters(maxClusters = 6, maxPerCluster = 30): Cluster[] {
  if (typeof window === "undefined") return [];
  const cmap = counts.all();
  const cache = songCache.all();
  const clusters = new Map<string, Cluster>();

  for (const [songId, c] of Object.entries(cmap)) {
    const song = cache[songId];
    const artist = song?.artists?.primary?.[0];
    if (!song || !artist) continue;
    const key = `${normalize(artist.name)}::${normalize(song.language)}`;
    let cl = clusters.get(key);
    if (!cl) {
      cl = {
        key,
        artistName: artist.name,
        artistId: artist.id,
        language: song.language || "",
        totalPlays: 0,
        topSong: song,
        songs: [],
      };
      clusters.set(key, cl);
    }
    cl.totalPlays += c;
    cl.songs.push(song);
    if ((counts.get(songId) || 0) > (counts.get(cl.topSong.id) || 0)) cl.topSong = song;
  }

  return Array.from(clusters.values())
    .filter((c) => c.songs.length >= 2)
    .sort((a, b) => b.totalPlays - a.totalPlays)
    .slice(0, maxClusters)
    .map((c) => ({ ...c, songs: c.songs.slice(0, maxPerCluster) }));
}

/** Songs played 3+ times in the last 30 days, sorted by recent play count. */
export function getOnRepeat(limit = 30): Song[] {
  if (typeof window === "undefined") return [];
  const cache = songCache.all();
  const cutoff = Date.now() - 30 * DAY;
  const recentCounts = new Map<string, number>();
  for (const e of history.list()) {
    if (e.timestamp < cutoff) break; // history is newest-first
    recentCounts.set(e.songId, (recentCounts.get(e.songId) || 0) + 1);
  }
  return Array.from(recentCounts.entries())
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => cache[id])
    .filter(Boolean)
    .slice(0, limit);
}

/** Songs heavily played 60+ days ago, but barely played in the last 30 days. */
export function getRepeatRewind(limit = 30): Song[] {
  if (typeof window === "undefined") return [];
  const cache = songCache.all();
  const oldCutoff = Date.now() - 60 * DAY;
  const recentCutoff = Date.now() - 30 * DAY;
  const oldCounts = new Map<string, number>();
  const recentCounts = new Map<string, number>();
  for (const e of history.list()) {
    if (e.timestamp >= recentCutoff) {
      recentCounts.set(e.songId, (recentCounts.get(e.songId) || 0) + 1);
    } else if (e.timestamp < oldCutoff) {
      oldCounts.set(e.songId, (oldCounts.get(e.songId) || 0) + 1);
    }
  }
  return Array.from(oldCounts.entries())
    .filter(([id, c]) => c >= 3 && (recentCounts.get(id) || 0) < 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => cache[id])
    .filter(Boolean)
    .slice(0, limit);
}

/** Songs played around this week of the year, in any prior year. */
export function getTimeCapsule(limit = 25): Song[] {
  if (typeof window === "undefined") return [];
  const cache = songCache.all();
  const now = new Date();
  const wk = 7 * DAY;
  const ids = new Set<string>();
  for (const e of history.list()) {
    const d = new Date(e.timestamp);
    if (d.getFullYear() >= now.getFullYear()) continue;
    // Same time of year, within 14-day window
    const diff = Math.abs(
      (now.getTime() - now.setFullYear(d.getFullYear())) % (365 * DAY)
    );
    if (Math.min(diff, 365 * DAY - diff) < wk * 2) ids.add(e.songId);
    now.setFullYear(new Date().getFullYear());
  }
  const out: Song[] = [];
  for (const id of ids) {
    const s = cache[id];
    if (s) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Smart shuffle: avoid the last 5 recently-played, prefer liked songs. */
export function smartShuffle<T extends { id: string }>(songs: T[]): T[] {
  if (!songs.length) return songs;
  const recentIds = new Set(recent.list().slice(0, 5).map((s) => s.id));
  const likedIds = new Set(liked.list());
  const buckets: { song: T; weight: number }[] = songs.map((s) => {
    let w = 1;
    if (likedIds.has(s.id)) w += 1.5;
    if (recentIds.has(s.id)) w *= 0.1;
    return { song: s, weight: w };
  });
  const out: T[] = [];
  while (buckets.length) {
    const total = buckets.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * total;
    let picked = 0;
    for (let i = 0; i < buckets.length; i++) {
      r -= buckets[i].weight;
      if (r <= 0) { picked = i; break; }
    }
    out.push(buckets[picked].song);
    buckets.splice(picked, 1);
  }
  return out;
}

/**
 * "Because you played {X}" — pick a random recently-played song that produced
 * a recommendation. Returns the source song the user can be told about.
 */
export function getBecauseYouPlayed(): Song | null {
  if (typeof window === "undefined") return null;
  const r = recent.list();
  if (!r.length) return null;
  const top = r.slice(0, 8);
  return top[Math.floor(Math.random() * top.length)];
}

/** Listening streak in days (consecutive days with at least 1 play). */
export function getStreak(): number {
  if (typeof window === "undefined") return 0;
  const days = new Set<string>();
  for (const e of history.list()) {
    const d = new Date(e.timestamp);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) streak++;
    else if (i > 0) break; // missed today is OK, but missed yesterday breaks streak
  }
  return streak;
}

export interface RecapStats {
  totalPlays: number;
  uniqueArtists: number;
  uniqueLanguages: number;
  hours: number;
  topArtist: string;
  topSong: string;
  newDiscoveriesThisWeek: number;
}

/** Stats for the weekly recap card. */
export function getWeeklyRecap(): RecapStats {
  if (typeof window === "undefined") {
    return { totalPlays: 0, uniqueArtists: 0, uniqueLanguages: 0, hours: 0, topArtist: "—", topSong: "—", newDiscoveriesThisWeek: 0 };
  }
  const cache = songCache.all();
  const since = Date.now() - 7 * DAY;
  const artists = new Set<string>();
  const langs = new Set<string>();
  const songCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  const seenSongIds = new Set<string>();
  let total = 0;
  for (const e of history.list()) {
    if (e.timestamp < since) break;
    total++;
    const s = cache[e.songId];
    if (!s) continue;
    seenSongIds.add(e.songId);
    songCounts.set(e.songId, (songCounts.get(e.songId) || 0) + 1);
    const a = s.artists?.primary?.[0];
    if (a) {
      artists.add(a.id);
      artistCounts.set(a.name, (artistCounts.get(a.name) || 0) + 1);
    }
    if (s.language) langs.add(s.language);
  }
  const topSongId = Array.from(songCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topArtistName = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  // New discoveries: songs whose only history is within the last 7 days
  let news = 0;
  for (const id of seenSongIds) {
    const all = history.list().filter((e) => e.songId === id);
    if (all.length && all[all.length - 1].timestamp >= since) news++;
  }
  return {
    totalPlays: total,
    uniqueArtists: artists.size,
    uniqueLanguages: langs.size,
    hours: Math.round(listenTime.get() / 3600 * 10) / 10,
    topArtist: topArtistName,
    topSong: topSongId ? cache[topSongId]?.name || "—" : "—",
    newDiscoveriesThisWeek: news,
  };
}
