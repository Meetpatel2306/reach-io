// Find a song by typing a snippet of its lyrics. Uses LRCLIB's search/lyric
// endpoint which lets us query any text string against their lyric database.

import type { Song } from "./types";

const BASE = "https://lrclib.net/api";

interface LrcLibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

interface LyricMatch {
  trackName: string;
  artistName: string;
  albumName?: string;
  snippet?: string;
}

export async function searchByLyric(snippet: string, limit = 10): Promise<LyricMatch[]> {
  if (snippet.trim().length < 4) return [];
  try {
    const url = `${BASE}/search?q=${encodeURIComponent(snippet)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as LrcLibTrack[];
    return data.slice(0, limit).map((t) => ({
      trackName: t.trackName,
      artistName: t.artistName,
      albumName: t.albumName,
      snippet: extractSnippet(t.plainLyrics || stripLrcTimestamps(t.syncedLyrics || ""), snippet),
    }));
  } catch { return []; }
}

function stripLrcTimestamps(s: string): string {
  return s.split("\n").map((l) => l.replace(/\[\d+:\d+(?:\.\d+)?\]\s*/g, "")).join("\n");
}

function extractSnippet(text: string, query: string): string | undefined {
  if (!text) return;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, 80);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + query.length + 50);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}
