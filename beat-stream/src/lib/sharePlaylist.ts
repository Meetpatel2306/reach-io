// Share a user-created playlist as a URL hash that anyone can paste back into
// BeatStream to import. Songs are encoded as id + name + artist so the
// receiving client can either play directly (if Saavn ids) or re-search.

import type { UserPlaylist, Song } from "./types";
import { songCache, playlists } from "./storage";

interface SharePayload {
  v: 1;
  name: string;
  description?: string;
  songs: { id: string; n: string; a: string }[];
}

function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

export function buildShareUrl(p: UserPlaylist): string {
  const cache = songCache.all();
  const payload: SharePayload = {
    v: 1,
    name: p.name,
    description: p.description,
    songs: p.songIds.map((id) => {
      const s = cache[id];
      return { id, n: s?.name || "", a: s?.artists?.primary?.[0]?.name || "" };
    }),
  };
  const compact = b64encode(JSON.stringify(payload));
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/library?import=${compact}`;
}

export function decodeShareUrl(encoded: string): SharePayload | null {
  try {
    const json = b64decode(encoded);
    return JSON.parse(json) as SharePayload;
  } catch { return null; }
}

export function importFromShare(payload: SharePayload): UserPlaylist {
  const p = playlists.create(payload.name, payload.description || "");
  payload.songs.forEach((s) => {
    if (s.id) playlists.addSong(p.id, s.id);
  });
  return p;
}
