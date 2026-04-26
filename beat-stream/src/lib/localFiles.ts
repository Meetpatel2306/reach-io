// Local file import: drag/drop or pick MP3/FLAC/OGG/WAV into the app.
//
// Audio bytes go to IndexedDB (via existing audioCache) so they persist across
// sessions. Metadata (name, duration, size) goes to localStorage so it shows
// up in the Library. We synthesize a Song with id `local_<random>` so the
// existing player handles them like any other song — its src() path checks
// IndexedDB first.

import { audioCache } from "./audioCache";
import { localFiles, songCache, type LocalFile } from "./storage";
import type { Song } from "./types";

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = url;
    a.onloadedmetadata = () => {
      const d = a.duration || 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
  });
}

/** Parse "Artist - Title" or "Title" from a filename. */
function parseFilename(name: string): { name: string; artist: string } {
  const stripped = name.replace(/\.(mp3|flac|m4a|ogg|wav|aac)$/i, "").trim();
  const dash = stripped.indexOf(" - ");
  if (dash > 0) {
    return { artist: stripped.slice(0, dash).trim(), name: stripped.slice(dash + 3).trim() };
  }
  return { name: stripped, artist: "Unknown Artist" };
}

export async function importFile(file: File): Promise<Song> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const blob = new Blob([await file.arrayBuffer()], { type: file.type || "audio/mpeg" });
  await audioCache.put(id, blob);
  const duration = await readDuration(file);
  const parsed = parseFilename(file.name);
  const meta: LocalFile = {
    id,
    name: parsed.name,
    artist: parsed.artist,
    duration: Math.round(duration),
    size: file.size,
    mimeType: file.type || "audio/mpeg",
    importedAt: Date.now(),
  };
  localFiles.add(meta);

  // Also stash a Song entry in the cache so the player + library treat it like any other song
  const song: Song = {
    id,
    name: meta.name,
    duration: meta.duration,
    artists: { primary: [{ id: "local", name: meta.artist }] },
    image: [],
    // Single fake downloadUrl so pickDownloadUrl returns *something*; the
    // PlayerContext checks IndexedDB first via audioCache.get(id) so this
    // URL is only a fallback marker.
    downloadUrl: [{ quality: "320kbps", url: `local://${id}` }],
  };
  songCache.put(song);
  return song;
}

export async function importFiles(files: FileList | File[]): Promise<Song[]> {
  const out: Song[] = [];
  for (const f of Array.from(files)) {
    if (!/^audio\//.test(f.type) && !/\.(mp3|flac|m4a|ogg|wav|aac)$/i.test(f.name)) continue;
    try { out.push(await importFile(f)); } catch {}
  }
  return out;
}

export async function removeLocal(id: string): Promise<void> {
  localFiles.remove(id);
  await audioCache.remove(id);
}
