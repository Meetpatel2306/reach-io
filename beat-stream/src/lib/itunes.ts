// iTunes Search API adapter.
//
// Why: Apple's public iTunes Search endpoint is the most reliable, CORS-
// enabled, no-auth catalog of Western music metadata in existence. Even when
// JioSaavn returns 5 Ed Sheeran songs and Piped/YouTube is down, iTunes will
// happily return 50+ tracks with full metadata (title, artist, album,
// duration, artwork) for every famous foreign artist.
//
// We can't STREAM from iTunes (the official preview URLs are only 30 s).
// Instead we synthesize Song objects with an `itunes:<id>` id and an empty
// downloadUrl[]. When the user taps play, the player's `ensureFullSong` path
// hydrates them via `resolveItunesStream` which searches YouTube/Piped for a
// matching track and returns its stream URL.
//
// Net effect: foreign-artist pages now SHOW the full catalog reliably; they
// PLAY by transparently routing through YouTube. Saavn → iTunes (metadata)
// → YouTube (audio).

import type { Song } from "./types";
import { resolveYtStreamUrl, ytSearchSongs } from "./youtubeMusic";

const BASE = "https://itunes.apple.com/search";
const TIMEOUT = 6_000;

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  isStreamable?: boolean;
}

interface ItunesResponse { resultCount: number; results: ItunesTrack[]; }

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

/** Upsize iTunes' tiny 100×100 artwork URL to something usable at 600×600. */
function upsizeArt(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/[0-9]+x[0-9]+(bb)?\.(jpg|png)$/, "/600x600bb.$2");
}

function buildSongFromItunes(t: ItunesTrack): Song {
  const art = upsizeArt(t.artworkUrl100);
  return {
    id: `itunes:${t.trackId}`,
    name: t.trackName,
    type: "song",
    duration: Math.round((t.trackTimeMillis || 0) / 1000),
    year: t.releaseDate ? new Date(t.releaseDate).getFullYear() : undefined,
    language: "english",
    source: "youtube" as const,        // we'll resolve via YT at play-time
    artists: { primary: [{ id: `it:${t.artistName}`, name: t.artistName }] },
    album: t.collectionName ? { id: `it-album:${t.collectionName}`, name: t.collectionName } : undefined,
    image: art ? [
      { quality: "50x50", url: art },
      { quality: "150x150", url: art },
      { quality: "500x500", url: art },
    ] : [],
    downloadUrl: [], // hydrated lazily via resolveItunesStream
  };
}

/**
 * Search iTunes for an artist's catalog. Returns up to `limit` Song objects.
 * Filters out duplicates by trackName (iTunes returns each track once per
 * collection — single + album version + remastered etc.). We keep the first.
 */
export async function itunesArtistSongs(artist: string, limit = 100): Promise<Song[]> {
  const params = new URLSearchParams({
    term: artist,
    media: "music",
    entity: "song",
    attribute: "artistTerm",
    limit: String(Math.min(200, limit * 2)),
  });
  try {
    const res = await fetchWithTimeout(`${BASE}?${params.toString()}`, TIMEOUT);
    if (!res.ok) return [];
    const data = (await res.json()) as ItunesResponse;
    const seen = new Set<string>();
    const out: Song[] = [];
    for (const t of (data.results || [])) {
      // Loose artist-name match safety net — iTunes' attribute filter is fuzzy
      const tArtist = (t.artistName || "").toLowerCase();
      const aLower = artist.toLowerCase();
      if (!tArtist.includes(aLower) && !aLower.includes(tArtist)) continue;
      const key = (t.trackName || "").toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(buildSongFromItunes(t));
      if (out.length >= limit) break;
    }
    return out;
  } catch { return []; }
}

/**
 * For a Song originally synthesized from iTunes metadata, find a matching
 * YouTube/Piped audio stream and return a working stream URL. Used by the
 * player's hydration path when the user actually presses play.
 */
export async function resolveItunesStream(song: Song): Promise<string | null> {
  if (!song?.id?.startsWith("itunes:") && song.source !== "youtube") return null;
  try {
    const artist = song.artists?.primary?.[0]?.name || "";
    const title = song.name || "";
    const yt = await ytSearchSongs(`${title} ${artist}`, 3);
    if (!yt.length) return null;
    // Pick the first result whose duration is within 15s of metadata
    const targetDur = typeof song.duration === "string" ? parseInt(song.duration, 10) : (song.duration || 0);
    let best = yt[0];
    if (targetDur > 0) {
      best = yt.reduce((acc, cand) => {
        const cd = typeof cand.duration === "string" ? parseInt(cand.duration, 10) : (cand.duration || 0);
        const ad = typeof acc.duration === "string" ? parseInt(acc.duration, 10) : (acc.duration || 0);
        return Math.abs(cd - targetDur) < Math.abs(ad - targetDur) ? cand : acc;
      }, yt[0]);
    }
    if (!best.ytId) return null;
    return await resolveYtStreamUrl(best.ytId);
  } catch { return null; }
}
