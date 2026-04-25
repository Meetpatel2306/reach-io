"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { liked, savedAlbums, followedArtists, savedPlaylists, playlists, downloads, counts, blockedSongs, blockedArtists } from "@/lib/storage";
import type { UserPlaylist } from "@/lib/types";

interface Ctx {
  likedIds: string[];
  savedAlbumIds: string[];
  followedArtistIds: string[];
  savedPlaylistIds: string[];
  userPlaylists: UserPlaylist[];
  downloadIds: string[];
  blockedSongIds: string[];
  blockedArtistIds: string[];
  isLiked: (id: string) => boolean;
  toggleLike: (id: string) => boolean;
  isSavedAlbum: (id: string) => boolean;
  toggleSavedAlbum: (id: string) => boolean;
  isFollowedArtist: (id: string) => boolean;
  toggleFollowedArtist: (id: string) => boolean;
  isSavedPlaylist: (id: string) => boolean;
  toggleSavedPlaylist: (id: string) => boolean;
  refreshPlaylists: () => void;
  createPlaylist: (name: string, description?: string) => UserPlaylist;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, songId: string) => void;
  removeFromPlaylist: (playlistId: string, songId: string) => void;
  refreshDownloads: () => void;
  isBlockedSong: (id: string) => boolean;
  toggleBlockSong: (id: string) => boolean;
  isBlockedArtist: (id: string) => boolean;
  toggleBlockArtist: (id: string) => boolean;
  topPlayed: (n?: number) => string[];
}

const LibraryCtx = createContext<Ctx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [savedAlbumIds, setSavedAlbumIds] = useState<string[]>([]);
  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>([]);
  const [savedPlaylistIds, setSavedPlaylistIds] = useState<string[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [downloadIds, setDownloadIds] = useState<string[]>([]);
  const [blockedSongIds, setBlockedSongIds] = useState<string[]>([]);
  const [blockedArtistIds, setBlockedArtistIds] = useState<string[]>([]);

  useEffect(() => {
    setLikedIds(liked.list());
    setSavedAlbumIds(savedAlbums.list());
    setFollowedArtistIds(followedArtists.list());
    setSavedPlaylistIds(savedPlaylists.list());
    setUserPlaylists(playlists.list());
    setDownloadIds(downloads.list().map((d) => d.songId));
    setBlockedSongIds(blockedSongs.list());
    setBlockedArtistIds(blockedArtists.list());
  }, []);

  const toggleLike = useCallback((id: string) => { const a = liked.toggle(id); setLikedIds(liked.list()); return a; }, []);
  const toggleSavedAlbum = useCallback((id: string) => { const a = savedAlbums.toggle(id); setSavedAlbumIds(savedAlbums.list()); return a; }, []);
  const toggleFollowedArtist = useCallback((id: string) => { const a = followedArtists.toggle(id); setFollowedArtistIds(followedArtists.list()); return a; }, []);
  const toggleSavedPlaylist = useCallback((id: string) => { const a = savedPlaylists.toggle(id); setSavedPlaylistIds(savedPlaylists.list()); return a; }, []);
  const toggleBlockSong = useCallback((id: string) => { const a = blockedSongs.toggle(id); setBlockedSongIds(blockedSongs.list()); return a; }, []);
  const toggleBlockArtist = useCallback((id: string) => { const a = blockedArtists.toggle(id); setBlockedArtistIds(blockedArtists.list()); return a; }, []);

  const refreshPlaylists = useCallback(() => setUserPlaylists(playlists.list()), []);
  const refreshDownloads = useCallback(() => setDownloadIds(downloads.list().map((d) => d.songId)), []);

  const createPlaylist = useCallback((name: string, description = "") => {
    const p = playlists.create(name, description);
    refreshPlaylists();
    return p;
  }, [refreshPlaylists]);

  const deletePlaylist = useCallback((id: string) => { playlists.remove(id); refreshPlaylists(); }, [refreshPlaylists]);
  const addToPlaylist = useCallback((pid: string, sid: string) => { playlists.addSong(pid, sid); refreshPlaylists(); }, [refreshPlaylists]);
  const removeFromPlaylist = useCallback((pid: string, sid: string) => { playlists.removeSong(pid, sid); refreshPlaylists(); }, [refreshPlaylists]);

  return (
    <LibraryCtx.Provider value={{
      likedIds, savedAlbumIds, followedArtistIds, savedPlaylistIds, userPlaylists, downloadIds, blockedSongIds, blockedArtistIds,
      isLiked: (id) => likedIds.includes(id),
      toggleLike,
      isSavedAlbum: (id) => savedAlbumIds.includes(id),
      toggleSavedAlbum,
      isFollowedArtist: (id) => followedArtistIds.includes(id),
      toggleFollowedArtist,
      isSavedPlaylist: (id) => savedPlaylistIds.includes(id),
      toggleSavedPlaylist,
      refreshPlaylists,
      createPlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      refreshDownloads,
      isBlockedSong: (id) => blockedSongIds.includes(id),
      toggleBlockSong,
      isBlockedArtist: (id) => blockedArtistIds.includes(id),
      toggleBlockArtist,
      topPlayed: (n = 50) => counts.top(n),
    }}>
      {children}
    </LibraryCtx.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryCtx);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
