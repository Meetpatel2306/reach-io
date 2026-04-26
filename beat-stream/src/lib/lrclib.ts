// LRCLIB lyrics client.
//
// LRCLIB (https://lrclib.net) is a free, CORS-enabled, no-auth lyrics database
// with synced (LRC-format) lyrics for hundreds of thousands of tracks. We use
// it as the lyrics fallback whenever JioSaavn doesn't ship lyrics for a song.

const BASE = "https://lrclib.net/api";
const TIMEOUT = 6_000;

interface LrcLibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      clearTimeout(id);
    }
  } catch {
    return null;
  }
}

export interface LyricsResult {
  plain: string | null;
  synced: string | null;        // LRC format with [mm:ss.xx] timestamps
}

/** Best-effort lyrics lookup. Returns null if nothing found. */
export async function getLrcLibLyrics(
  artist: string,
  track: string,
  album?: string,
  durationSec?: number,
): Promise<LyricsResult | null> {
  // 1. Exact match endpoint — fastest when we have all signals.
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: track,
  });
  if (album) params.set("album_name", album);
  if (durationSec) params.set("duration", String(Math.round(durationSec)));

  const exact = await fetchJson<LrcLibTrack>(`${BASE}/get?${params.toString()}`);
  if (exact && (exact.syncedLyrics || exact.plainLyrics)) {
    return { plain: exact.plainLyrics ?? null, synced: exact.syncedLyrics ?? null };
  }

  // 2. Fallback to fuzzy search and pick the best candidate.
  const search = await fetchJson<LrcLibTrack[]>(
    `${BASE}/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`,
  );
  if (!search?.length) return null;

  // Prefer entries that actually have synced lyrics, then plain.
  const withSynced = search.find((t) => t.syncedLyrics);
  const withPlain = search.find((t) => t.plainLyrics);
  const pick = withSynced || withPlain;
  if (!pick) return null;
  return { plain: pick.plainLyrics ?? null, synced: pick.syncedLyrics ?? null };
}

/** Convenience: just the displayable text (synced preferred, plain fallback). */
export async function getLrcLibPlainText(
  artist: string,
  track: string,
  album?: string,
  durationSec?: number,
): Promise<string | null> {
  const r = await getLrcLibLyrics(artist, track, album, durationSec);
  if (!r) return null;
  if (r.synced) {
    // Strip leading [mm:ss.xx] from each line so plain consumers get clean text.
    return r.synced
      .split("\n")
      .map((line) => line.replace(/^\[\d+:\d+(?:\.\d+)?\]\s*/, ""))
      .filter((l) => l.trim().length > 0)
      .join("\n");
  }
  return r.plain || null;
}
