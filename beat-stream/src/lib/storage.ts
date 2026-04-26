import type { Song, UserPlaylist, Settings, DownloadEntry, PlayHistoryEntry, EqualizerSettings, EnhancementSettings } from "./types";

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
  volume: "bs-volume",
  muted: "bs-muted",
  ratings: "bs-ratings",
  tags: "bs-tags",
  hidden: "bs-hidden-songs",
  smartPlaylists: "bs-smart-playlists",
  skipStats: "bs-skip-stats",
  localFiles: "bs-local-files",
  achievements: "bs-achievements",
  dailyGoalMinutes: "bs-daily-goal-minutes",
  eqProfiles: "bs-eq-profiles",
  playlistFolders: "bs-playlist-folders",
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

export const defaultEnhancement: EnhancementSettings = {
  bassEnhancer: 0,
  stereoWidener: 50,
  compressor: 0,
  loudness: 0,
  limiter: true,
};

export const defaultSettings: Settings = {
  quality: "320kbps",
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
  enhancement: defaultEnhancement,
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

// ─── Ratings (1-5 stars per song) ─────────────────────────────────────
export const ratings = {
  all: () => read<Record<string, number>>(K.ratings, {}),
  get: (id: string) => ratings.all()[id] || 0,
  set: (id: string, n: number) => {
    const m = ratings.all();
    if (n <= 0) delete m[id]; else m[id] = Math.min(5, Math.max(1, n));
    write(K.ratings, m);
  },
};

// ─── Tags (string[] per song) ─────────────────────────────────────────
export const tags = {
  all: () => read<Record<string, string[]>>(K.tags, {}),
  get: (id: string) => tags.all()[id] || [],
  set: (id: string, arr: string[]) => {
    const m = tags.all();
    if (!arr.length) delete m[id]; else m[id] = arr;
    write(K.tags, m);
  },
  add: (id: string, t: string) => {
    const cur = tags.get(id);
    if (!cur.includes(t)) tags.set(id, [...cur, t]);
  },
  remove: (id: string, t: string) => tags.set(id, tags.get(id).filter((x) => x !== t)),
  // Universe of all tags ever used (for autocomplete)
  vocabulary: (): string[] => {
    const all = tags.all();
    const set = new Set<string>();
    Object.values(all).forEach((arr) => arr.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  },
};

// ─── Hidden songs (softer than blocked: still playable if explicit) ───
export const hidden = makeIdSet(K.hidden);

// ─── Skip stats (for auto-skip prediction) ────────────────────────────
export interface SkipStat { plays: number; skips: number; }
export const skipStats = {
  all: () => read<Record<string, SkipStat>>(K.skipStats, {}),
  get: (id: string): SkipStat => skipStats.all()[id] || { plays: 0, skips: 0 },
  recordPlay: (id: string, completedRatio: number) => {
    const m = skipStats.all();
    const cur = m[id] || { plays: 0, skips: 0 };
    cur.plays += 1;
    if (completedRatio < 0.4) cur.skips += 1; // listened to <40% → counts as skip
    m[id] = cur;
    write(K.skipStats, m);
  },
  shouldAutoSkip: (id: string): boolean => {
    const s = skipStats.get(id);
    return s.plays >= 3 && s.skips / s.plays >= 0.7;
  },
  clear: () => write(K.skipStats, {}),
};

// ─── Smart Playlists ──────────────────────────────────────────────────
export interface SmartPlaylistRule {
  field: "language" | "artist" | "year" | "plays" | "liked" | "duration" | "rating" | "tag";
  op: "is" | "isNot" | "contains" | "gt" | "lt" | "gte" | "lte";
  value: string | number | boolean;
}
export interface SmartPlaylist {
  id: string;
  name: string;
  description?: string;
  rules: SmartPlaylistRule[];
  combine: "and" | "or";
  createdAt: number;
}
export const smartPlaylists = {
  list: () => read<SmartPlaylist[]>(K.smartPlaylists, []),
  create: (name: string, rules: SmartPlaylistRule[], combine: "and" | "or" = "and"): SmartPlaylist => {
    const all = smartPlaylists.list();
    const sp: SmartPlaylist = {
      id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name, rules, combine, createdAt: Date.now(),
    };
    all.unshift(sp);
    write(K.smartPlaylists, all);
    return sp;
  },
  update: (id: string, patch: Partial<SmartPlaylist>) => {
    const all = smartPlaylists.list();
    const idx = all.findIndex((p) => p.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], ...patch };
    write(K.smartPlaylists, all);
  },
  remove: (id: string) => write(K.smartPlaylists, smartPlaylists.list().filter((p) => p.id !== id)),
  get: (id: string) => smartPlaylists.list().find((p) => p.id === id),
};

// ─── Local files (metadata; blob lives in IndexedDB audio cache) ──────
export interface LocalFile {
  id: string;            // synthetic: "local_<random>"
  name: string;
  artist: string;
  duration: number;
  size: number;
  mimeType: string;
  importedAt: number;
}
export const localFiles = {
  list: () => read<LocalFile[]>(K.localFiles, []),
  add: (f: LocalFile) => {
    const all = localFiles.list();
    all.unshift(f);
    write(K.localFiles, all);
  },
  remove: (id: string) => write(K.localFiles, localFiles.list().filter((f) => f.id !== id)),
  clear: () => write(K.localFiles, []),
};

// ─── Achievements ─────────────────────────────────────────────────────
export const achievements = {
  unlocked: () => read<string[]>(K.achievements, []),
  has: (id: string) => achievements.unlocked().includes(id),
  unlock: (id: string): boolean => {
    if (achievements.has(id)) return false;
    write(K.achievements, [...achievements.unlocked(), id]);
    return true;
  },
};

// ─── Daily goal ───────────────────────────────────────────────────────
export const dailyGoal = {
  get: () => read<number>(K.dailyGoalMinutes, 30),
  set: (m: number) => write(K.dailyGoalMinutes, m),
};

// ─── EQ profile slots ─────────────────────────────────────────────────
export interface EqProfile { id: string; name: string; eq: EqualizerSettings; }
export const eqProfiles = {
  list: () => read<EqProfile[]>(K.eqProfiles, []),
  save: (name: string, eq: EqualizerSettings) => {
    const all = eqProfiles.list();
    all.unshift({ id: `eqp_${Date.now()}`, name, eq });
    write(K.eqProfiles, all);
  },
  remove: (id: string) => write(K.eqProfiles, eqProfiles.list().filter((p) => p.id !== id)),
};

// ─── Playlist folders ─────────────────────────────────────────────────
export interface PlaylistFolder { id: string; name: string; playlistIds: string[]; }
export const playlistFolders = {
  list: () => read<PlaylistFolder[]>(K.playlistFolders, []),
  create: (name: string): PlaylistFolder => {
    const f: PlaylistFolder = { id: `fld_${Date.now()}`, name, playlistIds: [] };
    write(K.playlistFolders, [f, ...playlistFolders.list()]);
    return f;
  },
  remove: (id: string) => write(K.playlistFolders, playlistFolders.list().filter((f) => f.id !== id)),
  addPlaylist: (folderId: string, playlistId: string) => {
    const all = playlistFolders.list();
    const idx = all.findIndex((f) => f.id === folderId);
    if (idx < 0) return;
    if (!all[idx].playlistIds.includes(playlistId)) all[idx].playlistIds.push(playlistId);
    write(K.playlistFolders, all);
  },
  removePlaylist: (folderId: string, playlistId: string) => {
    const all = playlistFolders.list();
    const idx = all.findIndex((f) => f.id === folderId);
    if (idx < 0) return;
    all[idx].playlistIds = all[idx].playlistIds.filter((p) => p !== playlistId);
    write(K.playlistFolders, all);
  },
};

// ─── Backup / restore ─────────────────────────────────────────────────
export const backup = {
  export: (): string => {
    const data: Record<string, unknown> = {};
    Object.values(K).forEach((k) => {
      if (typeof window === "undefined") return;
      const v = localStorage.getItem(k);
      if (v != null) data[k] = JSON.parse(v);
    });
    return JSON.stringify({ version: 1, exportedAt: Date.now(), data }, null, 2);
  },
  import: (json: string): boolean => {
    try {
      const obj = JSON.parse(json);
      if (!obj?.data) return false;
      Object.entries(obj.data).forEach(([k, v]) => {
        if (Object.values(K).includes(k as any)) write(k, v);
      });
      return true;
    } catch { return false; }
  },
};
