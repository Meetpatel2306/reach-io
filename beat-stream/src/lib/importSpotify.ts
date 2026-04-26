// Import a public Spotify playlist URL by:
//   1. Extracting the playlist id from the URL
//   2. Fetching the public embed page (no auth needed) and scraping JSON-LD
//      / __NEXT_DATA__ for track names + artists
//   3. For each track, searching JioSaavn / our smart search to find a match
//   4. Building a UserPlaylist of the matches
//
// Spotify CORS-blocks most endpoints from a browser, so we use the public
// "embed.spotify.com" page which is freely fetchable. If the user's network
// blocks Spotify entirely we fall back to a manual paste flow.

import { smartSearch } from "./smartSearch";
import { playlists } from "./storage";
import type { Song } from "./types";

interface ScrapedTrack { name: string; artist: string; }

function extractPlaylistId(url: string): string | null {
  const m = url.match(/playlist[\/:]([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

async function scrapeEmbed(playlistId: string): Promise<{ title: string; tracks: ScrapedTrack[] }> {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("fetch failed");
  const html = await res.text();
  // Parse out the embedded JSON
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("no data in embed");
  const json = JSON.parse(match[1]);
  const playlist = json?.props?.pageProps?.state?.data?.entity || json?.props?.pageProps?.entity;
  const title = playlist?.title || playlist?.name || "Imported playlist";
  const tracks: ScrapedTrack[] = (playlist?.trackList || playlist?.tracks?.items || []).map((t: any) => ({
    name: t?.title || t?.name || t?.track?.name,
    artist: (t?.artists || t?.subtitle || []).map((a: any) => a?.name || a).join(", ") || "",
  })).filter((t: ScrapedTrack) => t.name);
  return { title, tracks };
}

/** Returns the new UserPlaylist's id and how many of N tracks matched. */
export async function importSpotifyPlaylist(url: string): Promise<{ playlistId: string; total: number; matched: number; name: string }> {
  const id = extractPlaylistId(url);
  if (!id) throw new Error("Not a Spotify playlist URL");
  const { title, tracks } = await scrapeEmbed(id);
  const p = playlists.create(title, "Imported from Spotify");
  let matched = 0;
  for (const t of tracks) {
    const bundle = await smartSearch(`${t.name} ${t.artist}`).catch(() => null);
    const best = bundle?.songs?.[0];
    if (best) {
      playlists.addSong(p.id, best.id);
      matched++;
    }
  }
  return { playlistId: p.id, total: tracks.length, matched, name: title };
}
