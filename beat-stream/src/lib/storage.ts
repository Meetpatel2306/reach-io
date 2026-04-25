import type { Song, UserPlaylist, Settings, DownloadEntry, PlayHistoryEntry, EqualizerSettings } from "./types";

const K = {
  liked: "bs-liked-songs",
  history: "bs-play-history",
  search: "bs-search-history",
  queue: "bs-queue",
  queueSource: "bs-queue-source",
  playlists: "bs-playlists",
  savedAlbums: "bs-saved-albums",
  followed: "bs-followed-artists",
  savedPlaylists: "bs-saved-playlists",
  settings: "bs-settings",
  current: "bs-current-song",
  counts: "bs-play-counts",
  downloads: "bs-downloads",
  songCache: "bs-song-cache",
  recentlyPlayed: "bs-recently-played",
  iosInstallDismissed: "bs-ios-install-dismissed",
  blockedSongs: "bs-blocked-songs",
  blockedArtists: "bs-blocked-artists",
  totalListenSeconds: "bs-total-listen-seconds",
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
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export const store = {
  read,
  write,
  remove: (k: string) => {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(k); } catch {}
  },
};

export const defaultEqualizer: EqualizerSettings = {
  enabled: false,
  preset: "Flat",
  gains: [0, 0, 0, 0, 0],
};

export const defaultSettings: Settings = {
  quality: "160kbps",
  downloadQuality: "320kbps",
  theme: "dark",
  accentColor: "green",
  crossfade: 0,
  gapless: true,
  normalize: false,
  autoplay: true,
  compact: false,
  showExplicit: true,
  displayName: "Music Lover",
  avatar: "🎧",
  vinylRotation: false,
  animations: true,
  equalizer: defaultEqualizer,
};

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

export const history = {
  list: () => read<PlayHistoryEntry[]>(K.history, []),
  push: (id: string) => {
    const list = history.list();
    list.unshift({ songId: id, timestamp: Date.now() });
    write(K.history, list.slice(0, 1000));
  },
  clear: () => write(K.history, []),
};

export const recent = {
  list: (): Song[] => read<Song[]>(K.recentlyPlayed, []),
  push: (song: Song) => {
    const list = recent.list().filter((s) => s.id !== song.id);
    list.unshift(song);
    write(K.recentlyPlayed, list.slice(0, 30));
  },
  clear: () => write(K.recentlyPlayed, []),
};

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
  get: (id: string) => counts.all()[id] || 0,
  clear: () => write(K.counts, {}),
};

export const listenTime = {
  get: () => read<number>(K.totalListenSeconds, 0),
  add: (seconds: number) => write(K.totalListenSeconds, listenTime.get() + seconds),
  clear: () => write(K.totalListenSeconds, 0),
};

export const searches = {
  list: () => read<string[]>(K.search, []),
  push: (q: string) => {
    if (!q.trim()) return;
    const list = searches.list().filter((x) => x.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    write(K.search, list.slice(0, 30));
  },
  remove: (q: string) => {
    write(K.search, searches.list().filter((x) => x !== q));
  },
  clear: () => write(K.search, []),
};

export const playlists = {
  list: () => read<UserPlaylist[]>(K.playlists, []),
  create: (name: string, description = ""): UserPlaylist => {
    const all = playlists.list();
    const p: UserPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name, description, songIds: [], createdAt: Date.now(),
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
  remove: (id: string) => write(K.playlists, playlists.list().filter((p) => p.id !== id)),
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
  reorder: (playlistId: string, from: number, to: number) => {
    const all = playlists.list();
    const idx = all.findIndex((p) => p.id === playlistId);
    if (idx < 0) return;
    const ids = all[idx].songIds.slice();
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    all[idx].songIds = ids;
    write(K.playlists, all);
  },
  get: (id: string) => playlists.list().find((p) => p.id === id),
};

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
    add: (id: string) => {
      const list = read<string[]>(key, []);
      if (!list.includes(id)) { list.unshift(id); write(key, list); }
    },
    remove: (id: string) => {
      write(key, read<string[]>(key, []).filter((x) => x !== id));
    },
    clear: () => write(key, []),
  };
}

export const savedAlbums = makeIdSet(K.savedAlbums);
export const followedArtists = makeIdSet(K.followed);
export const savedPlaylists = makeIdSet(K.savedPlaylists);
export const blockedSongs = makeIdSet(K.blockedSongs);
export const blockedArtists = makeIdSet(K.blockedArtists);

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

export const downloads = {
  list: () => read<DownloadEntry[]>(K.downloads, []),
  has: (id: string) => downloads.list().some((d) => d.songId === id),
  add: (e: DownloadEntry) => {
    const list = downloads.list().filter((d) => d.songId !== e.songId);
    list.unshift(e);
    write(K.downloads, list);
  },
  remove: (id: string) => write(K.downloads, downloads.list().filter((d) => d.songId !== id)),
  clear: () => write(K.downloads, []),
  totalBytes: () => downloads.list().reduce((s, d) => s + (d.size || 0), 0),
};
