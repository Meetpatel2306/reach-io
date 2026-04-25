"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, ListMusic, Heart, Trash2, Search as SearchIcon, X, HardDrive } from "lucide-react";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { songCache, downloads } from "@/lib/storage";
import { audioCache } from "@/lib/audioCache";
import { api } from "@/lib/api";
import type { Album, Artist, Song } from "@/lib/types";
import { SongRow } from "@/components/SongRow";
import { UserPlaylistCard } from "@/components/PlaylistCard";
import { AlbumCard } from "@/components/AlbumCard";
import { ArtistCard } from "@/components/ArtistCard";

type Tab = "playlists" | "songs" | "albums" | "artists" | "downloads";

function LibraryInner() {
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) || "playlists";
  const [tab, setTab] = useState<Tab>(initial);
  const { likedIds, savedAlbumIds, followedArtistIds, userPlaylists, downloadIds, createPlaylist, deletePlaylist, refreshDownloads } = useLibrary();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [songSort, setSongSort] = useState<"recent" | "title" | "artist" | "plays">("recent");
  const [songFilter, setSongFilter] = useState("");

  // Hydrate songs from cache
  const cache = typeof window !== "undefined" ? songCache.all() : {};
  const likedSongs: Song[] = likedIds.map((id) => cache[id]).filter(Boolean);
  const downloadedSongs: Song[] = downloadIds.map((id) => cache[id]).filter(Boolean);

  const filteredLiked = useMemo(() => {
    let arr = likedSongs;
    if (songFilter) {
      const q = songFilter.toLowerCase();
      arr = arr.filter((s) => s.name.toLowerCase().includes(q) || (s.artists?.primary || []).some((a) => a.name.toLowerCase().includes(q)));
    }
    if (songSort === "title") arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
    if (songSort === "artist") arr = [...arr].sort((a, b) => (a.artists?.primary?.[0]?.name || "").localeCompare(b.artists?.primary?.[0]?.name || ""));
    return arr;
  }, [likedSongs, songFilter, songSort]);

  // Fetch saved albums data
  const [savedAlbumsData, setSavedAlbumsData] = useState<Album[]>([]);
  const [followedData, setFollowedData] = useState<Artist[]>([]);

  useEffect(() => {
    Promise.all(savedAlbumIds.map((id) => api.getAlbum(id).catch(() => null)))
      .then((arr) => setSavedAlbumsData(arr.filter(Boolean) as Album[]));
  }, [savedAlbumIds]);

  useEffect(() => {
    Promise.all(followedArtistIds.map((id) => api.getArtist(id).catch(() => null)))
      .then((arr) => setFollowedData(arr.filter(Boolean) as Artist[]));
  }, [followedArtistIds]);

  function handleCreate() {
    if (!newName.trim()) return;
    createPlaylist(newName.trim());
    toast(`Created "${newName}"`, "success");
    setNewName("");
    setShowCreate(false);
  }

  async function deleteAllDownloads() {
    if (!confirm("Delete ALL downloaded songs?")) return;
    await audioCache.clear();
    downloads.clear();
    refreshDownloads();
    toast("All downloads deleted", "info");
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "playlists", label: "Playlists" },
    { key: "songs", label: "Songs" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
    { key: "downloads", label: "Downloads" },
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Your Library</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${tab === t.key ? "bg-white text-black" : "bg-card text-secondary hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "playlists" && (
        <div>
          <div className="flex flex-wrap gap-4 mb-2">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-card rounded-lg p-3 card-hover w-40 sm:w-44 md:w-48 flex flex-col items-center justify-center aspect-[4/5]"
            >
              <Plus className="w-12 h-12 text-secondary mb-2" />
              <span className="font-semibold text-sm">Create Playlist</span>
            </button>
            <Link
              href="/library?tab=songs"
              onClick={() => setTab("songs")}
              className="bg-gradient-to-br from-purple-600 to-blue-700 rounded-lg p-3 w-40 sm:w-44 md:w-48 flex flex-col justify-end aspect-[4/5] hover:scale-[1.02] transition"
            >
              <Heart className="w-10 h-10 text-white mb-2" />
              <div className="font-semibold text-sm">Liked Songs</div>
              <div className="text-xs text-white/80">{likedIds.length} songs</div>
            </Link>
            {userPlaylists.map((p) => (
              <div key={p.id} className="relative group">
                <UserPlaylistCard playlist={p} />
                <button
                  onClick={() => { if (confirm(`Delete "${p.name}"?`)) deletePlaylist(p.id); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/80"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "songs" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <input
                value={songFilter}
                onChange={(e) => setSongFilter(e.target.value)}
                placeholder="Search liked songs"
                className="w-full bg-card rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <select
              value={songSort}
              onChange={(e) => setSongSort(e.target.value as any)}
              className="bg-card rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="recent">Recently Added</option>
              <option value="title">Title (A-Z)</option>
              <option value="artist">Artist (A-Z)</option>
            </select>
          </div>
          {filteredLiked.length === 0 ? (
            <div className="text-center text-secondary py-12">
              <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No liked songs yet — tap the heart on songs you love
            </div>
          ) : (
            <div>{filteredLiked.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={filteredLiked} />)}</div>
          )}
        </div>
      )}

      {tab === "albums" && (
        <div>
          {savedAlbumsData.length === 0 ? (
            <div className="text-center text-secondary py-12">No saved albums yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {savedAlbumsData.map((a) => <AlbumCard key={a.id} album={a} />)}
            </div>
          )}
        </div>
      )}

      {tab === "artists" && (
        <div>
          {followedData.length === 0 ? (
            <div className="text-center text-secondary py-12">No followed artists yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {followedData.map((a) => <ArtistCard key={a.id} artist={a} />)}
            </div>
          )}
        </div>
      )}

      {tab === "downloads" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-secondary text-sm">
              <HardDrive className="w-4 h-4" />
              {downloadedSongs.length} downloaded songs
            </div>
            {downloadedSongs.length > 0 && (
              <button onClick={deleteAllDownloads} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 rounded-full">
                Delete all
              </button>
            )}
          </div>
          {downloadedSongs.length === 0 ? (
            <div className="text-center text-secondary py-12">
              <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No downloads yet — download songs for offline playback
            </div>
          ) : (
            <div>{downloadedSongs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={downloadedSongs} />)}</div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Create Playlist</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Playlist name"
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-secondary hover:text-white">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-accent text-black font-semibold rounded-full">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-secondary">Loading...</div>}>
      <LibraryInner />
    </Suspense>
  );
}
