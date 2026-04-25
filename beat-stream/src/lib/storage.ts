import type { Song, UserPlaylist, Settings, DownloadEntry, PlayHistoryEntry } from "./types";

const K = {
  liked: "beatstream-liked-songs",
  history: "beatstream-play-history",
  search: "beatstream-search-history",
  queue: "beatstream-queue",
  playlists: "beatstream-playlists",
  savedAlbums: "beatstream-saved-albums",
  followed: "beatstream-followed-artists",
  savedPlaylists: "beatstream-saved-playlists",
  settings: "beatstream-settings",
  current: "beatstream-current-song",
  counts: "beatstream-play-counts",
  downloads: "beatstream-downloads",
  songCache: "beatstream-song-cache",
  recentlyPlayed: "beatstream-recently-played",
  followedArtistsData: "beatstream-followed-data",
  savedAlbumsData: "beatstream-saved-albums-data",
  savedPlaylistsData: "beatstream-saved-playlists-data",
} as const;

export const STORAGE_KEYS = K;

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(k: string, v: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export const store = {
  read,
  write,
  remove: (k: string) => {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(k); } catch {}
  },
};

export const defaultSettings: Settings = {
  quality: "160kbps",
  downloadQuality: "320kbps",
  theme: "dark",
  accentColor: "emerald",
  crossfade: 0,
  gapless: true,
  normalize: false,
  autoplay: true,
  compact: false,
  showExplicit: true,
  displayName: "Music Lover",
  avatar: "🎧",
};

// Liked songs
export const liked = {
  list: () => read<string[]>(K.liked, []),
  has: (id: string) => liked.list().includes(id),
  toggle: (id: string): boolean => {
    const list = liked.list();
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1); else list.unshift(id);
    write(K.liked, list);
    return idx < 0;
  },
};

// Play history
export const history = {
  list: () => read<PlayHistoryEntry[]>(K.history, []),
  push: (id: string) => {
    const list = history.list();
    const filtered = list.filter((e) => e.songId !== id).slice(0, 499);
    filtered.unshift({ songId: id, timestamp: Date.now() });
    write(K.history, filtered);
  },
  clear: () => write(K.history, []),
};

// Recently played (with full song objects for quick access)
export const recent = {
  list: (): Song[] => read<Song[]>(K.recentlyPlayed, []),
  push: (song: Song) => {
    const list = recent.list().filter((s) => s.id !== song.id);
    list.unshift(song);
    write(K.recentlyPlayed, list.slice(0, 30));
  },
  clear: () => write(K.recentlyPlayed, []),
};

// Play counts
export const counts = {
  all: () => read<Record<string, number>>(K.counts, {}),
  inc: (id: string) => {
    const map = counts.all();
    map[id] = (map[id] || 0) + 1;
    write(K.counts, map);
  },
  top: (n = 50) => {
    const map = counts.all();
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id);
  },
  clear: () => write(K.counts, {}),
};

// Search history
export const searches = {
  list: () => read<string[]>(K.search, []),
  push: (q: string) => {
    if (!q.trim()) return;
    const list = searches.list().filter((x) => x.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    write(K.search, list.slice(0, 20));
  },
  clear: () => write(K.search, []),
};

// User playlists
export const playlists = {
  list: () => read<UserPlaylist[]>(K.playlists, []),
  create: (name: string, description = ""): UserPlaylist => {
    const all = playlists.list();
    const p: UserPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      songIds: [],
      createdAt: Date.now(),
    };
    all.unshift(p);
    write(K.playlists, all);
    return p;
  },
  update: (id: string, patch: Partial<UserPlaylist>) => {
    const all = playlists.list();
    const idx = all.findIndex((p) => p.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], ...patch };
    write(K.playlists, all);
  },
  remove: (id: string) => {
    write(K.playlists, playlists.list().filter((p) => p.id !== id));
  },
  addSong: (playlistId: string, songId: string) => {
    const all = playlists.list();
    const idx = all.findIndex((p) => p.id === playlistId);
    if (idx < 0) return;
    if (!all[idx].songIds.includes(songId)) all[idx].songIds.push(songId);
    write(K.playlists, all);
  },
  removeSong: (playlistId: string, songId: string) => {
    const all = playlists.list();
    const idx = all.findIndex((p) => p.id === playlistId);
    if (idx < 0) return;
    all[idx].songIds = all[idx].songIds.filter((s) => s !== songId);
    write(K.playlists, all);
  },
  get: (id: string) => playlists.list().find((p) => p.id === id),
};

// Saved albums / followed artists / saved external playlists
export function makeIdSet(key: string) {
  return {
    list: () => read<string[]>(key, []),
    has: (id: string) => read<string[]>(key, []).includes(id),
    toggle: (id: string): boolean => {
      const list = read<string[]>(key, []);
      const idx = list.indexOf(id);
      if (idx >= 0) list.splice(idx, 1); else list.unshift(id);
      write(key, list);
      return idx < 0;
    },
  };
}

export const savedAlbums = makeIdSet(K.savedAlbums);
export const followedArtists = makeIdSet(K.followed);
export const savedPlaylists = makeIdSet(K.savedPlaylists);

// Song cache (light metadata for any song the player has touched)
export const songCache = {
  all: () => read<Record<string, Song>>(K.songCache, {}),
  put: (song: Song) => {
    const map = songCache.all();
    map[song.id] = song;
    write(K.songCache, map);
  },
  putMany: (songs: Song[]) => {
    const map = songCache.all();
    songs.forEach((s) => { if (s?.id) map[s.id] = s; });
    write(K.songCache, map);
  },
  get: (id: string) => songCache.all()[id],
};

// Downloads metadata (audio blob lives in IndexedDB)
export const downloads = {
  list: () => read<DownloadEntry[]>(K.downloads, []),
  has: (id: string) => downloads.list().some((d) => d.songId === id),
  add: (e: DownloadEntry) => {
    const list = downloads.list().filter((d) => d.songId !== e.songId);
    list.unshift(e);
    write(K.downloads, list);
  },
  remove: (id: string) => {
    write(K.downloads, downloads.list().filter((d) => d.songId !== id));
  },
  clear: () => write(K.downloads, []),
};
