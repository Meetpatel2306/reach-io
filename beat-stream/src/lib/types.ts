export type Quality = "12kbps" | "48kbps" | "96kbps" | "160kbps" | "320kbps";

export interface ImageRef {
  quality: string;
  url: string;
}

export interface DownloadUrl {
  quality: Quality | string;
  url: string;
}

export interface ArtistRef {
  id: string;
  name: string;
  image?: ImageRef[] | string;
  role?: string;
  type?: string;
  url?: string;
}

export interface AlbumRef {
  id: string;
  name: string;
  url?: string;
}

export interface Song {
  id: string;
  name: string;
  type?: string;
  duration?: number | string;
  year?: number | string;
  language?: string;
  label?: string;
  explicitContent?: boolean;
  hasLyrics?: boolean;
  lyricsId?: string | null;
  url?: string;
  copyright?: string;
  album?: AlbumRef;
  artists?: { primary?: ArtistRef[]; featured?: ArtistRef[]; all?: ArtistRef[] };
  image?: ImageRef[];
  downloadUrl?: DownloadUrl[];
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  year?: number | string;
  type?: string;
  playCount?: number | null;
  language?: string;
  explicitContent?: boolean;
  songCount?: number;
  url?: string;
  image?: ImageRef[];
  artists?: { primary?: ArtistRef[]; all?: ArtistRef[] };
  songs?: Song[];
}

export interface Artist {
  id: string;
  name: string;
  url?: string;
  type?: string;
  image?: ImageRef[];
  followerCount?: number | string;
  fanCount?: string;
  isVerified?: boolean;
  dominantLanguage?: string;
  dominantType?: string;
  bio?: { title?: string; text?: string }[] | string;
  topSongs?: Song[];
  topAlbums?: Album[];
  singles?: Song[] | Album[];
  similarArtists?: Artist[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  year?: number | string;
  type?: string;
  playCount?: number | null;
  language?: string;
  explicitContent?: boolean;
  songCount?: number;
  url?: string;
  image?: ImageRef[];
  artists?: ArtistRef[];
  songs?: Song[];
}

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  songIds: string[];
  songs?: Song[];
  createdAt: number;
}

export interface PlayHistoryEntry {
  songId: string;
  timestamp: number;
}

export interface DownloadEntry {
  songId: string;
  quality: Quality | string;
  cachedAt: number;
  size?: number;
}

export type Theme = "dark" | "light" | "amoled" | "system";
export type AccentColor = "emerald" | "blue" | "purple" | "red" | "orange" | "pink";

export interface Settings {
  quality: Quality;
  downloadQuality: Quality;
  theme: Theme;
  accentColor: AccentColor;
  crossfade: number;
  gapless: boolean;
  normalize: boolean;
  autoplay: boolean;
  compact: boolean;
  showExplicit: boolean;
  displayName: string;
  avatar: string;
}
