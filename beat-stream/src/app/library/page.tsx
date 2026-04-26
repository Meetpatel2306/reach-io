"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Heart, Trash2, Search as SearchIcon, X, HardDrive, Grid3x3, List, ListMusic, Flame, Clock, Shuffle, Sparkles, FolderPlus, Upload, Link2 } from "lucide-react";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { songCache, downloads, counts, smartPlaylists, localFiles, type SmartPlaylist } from "@/lib/storage";
import { audioCache } from "@/lib/audioCache";
import { api } from "@/lib/api";
import { cached, TTL } from "@/lib/cache";
import type { Album, Artist, Song } from "@/lib/types";
import { decodeHtml, pickImage, shuffle as shuf } from "@/lib/utils";
import { SongRow } from "@/components/SongRow";
import { UserPlaylistCard } from "@/components/PlaylistCard";
import { AlbumCard } from "@/components/AlbumCard";
import { ArtistCard } from "@/components/ArtistCard";
import { SmartPlaylistEditor } from "@/components/SmartPlaylistEditor";
import { evaluateSmartPlaylist } from "@/lib/smartPlaylistEval";
import { importFiles, removeLocal } from "@/lib/localFiles";
import { decodeShareUrl, importFromShare } from "@/lib/sharePlaylist";
import { importSpotifyPlaylist } from "@/lib/importSpotify";

type Tab = "all" | "playlists" | "songs" | "albums" | "artists" | "downloads";

function LibraryInner() {
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) || "all";
  const [tab, setTab] = useState<Tab>(initial);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"recent" | "alpha" | "plays" | "duration" | "year">("recent");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showSmart, setShowSmart] = useState<SmartPlaylist | null | "new">(null);
  const [smartList, setSmartList] = useState<SmartPlaylist[]>([]);
  const [localList, setLocalList] = useState(() => (typeof window !== "undefined" ? localFiles.list() : []));
  const [dragHover, setDragHover] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  // Hooks that the effects below depend on must be declared first to avoid
  // the "block-scoped variable used before its declaration" type error.
  const { likedIds, savedAlbumIds, followedArtistIds, userPlaylists, downloadIds, createPlaylist, deletePlaylist, refreshDownloads, topPlayed } = useLibrary();
  const { toast } = useToast();
  const player = usePlayer();

  useEffect(() => { setSmartList(smartPlaylists.list()); }, [showSmart]);

  // Auto-import shared playlist via ?import=BASE64
  useEffect(() => {
    const code = params.get("import");
    if (!code) return;
    const decoded = decodeShareUrl(code);
    if (decoded) {
      const p = importFromShare(decoded);
      toast(`Imported "${p.name}" with ${p.songIds.length} songs`, "success");
      window.history.replaceState({}, "", "/library");
    }
  }, [params, toast]);

  async function handleFiles(files: FileList | File[]) {
    const songs = await importFiles(files);
    setLocalList(localFiles.list());
    toast(`Imported ${songs.length} file${songs.length !== 1 ? "s" : ""}`, "success");
  }

  async function handleImportSpotify() {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const r = await importSpotifyPlaylist(importUrl.trim());
      toast(`Imported "${r.name}" — matched ${r.matched}/${r.total}`, "success");
      setImportUrl(""); setShowImport(false);
    } catch (e: any) {
      toast(e?.message || "Import failed", "error");
    }
    setImporting(false);
  }

  const cache = typeof window !== "undefined" ? songCache.all() : {};
  const likedSongs: Song[] = likedIds.map((id) => cache[id]).filter(Boolean);
  const downloadedSongs: Song[] = downloadIds.map((id) => cache[id]).filter(Boolean);

  const filteredLiked = useMemo(() => {
    let arr = likedSongs;
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((s) => s.name.toLowerCase().includes(q) || (s.artists?.primary || []).some((a) => a.name.toLowerCase().includes(q)));
    }
    if (sort === "alpha") arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "plays") arr = [...arr].sort((a, b) => counts.get(b.id) - counts.get(a.id));
    if (sort === "duration") arr = [...arr].sort((a, b) => {
      const da = typeof a.duration === "string" ? parseInt(a.duration, 10) : (a.duration || 0);
      const db = typeof b.duration === "string" ? parseInt(b.duration, 10) : (b.duration || 0);
      return db - da;
    });
    if (sort === "year") arr = [...arr].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    return arr;
  }, [likedSongs, search, sort]);

  const [savedAlbumsData, setSavedAlbumsData] = useState<Album[]>([]);
  const [followedData, setFollowedData] = useState<Artist[]>([]);
  useEffect(() => {
    Promise.all(savedAlbumIds.map((id) =>
      cached(`album:${id}`, TTL.album, () => api.getAlbum(id)).catch(() => null)
    )).then((arr) => setSavedAlbumsData(arr.filter(Boolean) as Album[]));
  }, [savedAlbumIds]);
  useEffect(() => {
    Promise.all(followedArtistIds.map((id) =>
      cached(`artist-summary:${id}`, TTL.artist, () => api.getArtist(id)).catch(() => null)
    )).then((arr) => setFollowedData(arr.filter(Boolean) as Artist[]));
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

  function totalMB() { return (downloads.totalBytes() / 1024 / 1024).toFixed(1); }
  function isIOS() { return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent); }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "playlists", label: "Playlists" },
    { key: "songs", label: "Songs" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
    { key: "downloads", label: "Downloaded" },
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Your Library</h1>
        <div className="flex gap-2">
          <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "text-accent" : "text-secondary hover:text-white"}`} title="Grid view"><Grid3x3 className="w-5 h-5" /></button>
          <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "text-accent" : "text-secondary hover:text-white"}`} title="List view"><List className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${tab === t.key ? "bg-white text-black" : "bg-card text-secondary hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in library"
            className="w-full bg-card rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-card rounded-lg px-3 py-2 text-sm outline-none">
          <option value="recent">Recently Added</option>
          <option value="alpha">Alphabetical</option>
          <option value="plays">Most Played</option>
          <option value="duration">Duration</option>
          <option value="year">Year</option>
        </select>
        <button onClick={() => setShowSmart("new")} className="px-3 py-2 text-sm bg-accent/15 hover:bg-accent/25 text-accent rounded-lg flex items-center gap-1">
          <Sparkles className="w-4 h-4" /> Smart playlist
        </button>
        <button onClick={() => setShowImport(true)} className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1">
          <Link2 className="w-4 h-4" /> Import
        </button>
        <label className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 cursor-pointer">
          <Upload className="w-4 h-4" /> Local files
          <input type="file" multiple accept="audio/*,.mp3,.flac,.m4a,.ogg,.wav,.aac" className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.currentTarget.value = ""; }} />
        </label>
      </div>

      {/* Smart playlists strip */}
      {smartList.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title text-lg mb-3 px-1">Smart Playlists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {smartList.map((sp) => {
              const matches = evaluateSmartPlaylist(sp);
              return (
                <button key={sp.id} onClick={() => matches.length && player.playList(matches, 0, sp.name)}
                  className="bg-gradient-to-br from-accent/30 via-accent/10 to-transparent border border-accent/30 rounded-xl p-4 text-left hover:scale-[1.02] transition group">
                  <div className="flex items-start justify-between mb-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${sp.name}"?`)) { smartPlaylists.remove(sp.id); setSmartList(smartPlaylists.list()); } }}
                      className="opacity-0 group-hover:opacity-100 text-secondary hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="font-bold line-clamp-1">{sp.name}</div>
                  <div className="text-xs text-secondary mt-1">{matches.length} matches • {sp.rules.length} rule{sp.rules.length !== 1 ? "s" : ""}</div>
                  <button onClick={(e) => { e.stopPropagation(); setShowSmart(sp); }}
                    className="text-[11px] text-accent hover:underline mt-2">Edit</button>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Local files (always visible if user has any) */}
      {localList.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title text-lg mb-3 px-1">Local Files <span className="text-sm font-normal text-secondary">{localList.length}</span></h2>
          <div className="space-y-1">
            {localList.map((lf) => {
              const s = (typeof window !== "undefined" ? songCache.get(lf.id) : null) as Song | null;
              if (!s) return null;
              return (
                <div key={lf.id} className="flex items-center gap-2">
                  <div className="flex-1"><SongRow song={s} queue={localList.map((x) => songCache.get(x.id)).filter(Boolean) as Song[]} /></div>
                  <button onClick={async () => { await removeLocal(lf.id); setLocalList(localFiles.list()); toast("Removed", "info"); }}
                    className="p-2 text-secondary hover:text-red-400" title="Delete local file">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Drop-zone when dragging files over the page */}
      {dragHover && (
        <div className="fixed inset-0 z-50 bg-accent/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card rounded-2xl p-12 border-2 border-dashed border-accent">
            <Upload className="w-16 h-16 text-accent mx-auto mb-4" />
            <div className="text-2xl font-bold">Drop files to import</div>
          </div>
        </div>
      )}

      {/* Import-from-URL modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => !importing && setShowImport(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Import from URL</h3>
              <button onClick={() => !importing && setShowImport(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-secondary mb-3">Paste a Spotify or BeatStream playlist link. We'll find each song on JioSaavn / YouTube Music.</p>
            <input
              autoFocus value={importUrl} onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/…"
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => !importing && setShowImport(false)} className="px-4 py-2 text-secondary hover:text-white">Cancel</button>
              <button onClick={handleImportSpotify} disabled={importing || !importUrl.trim()}
                className="px-4 py-2 bg-accent text-black font-semibold rounded-full disabled:opacity-50">
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
            <p className="text-[11px] text-secondary mt-3">Spotify import works for public playlists only. For BeatStream-shared links, just paste — they import instantly.</p>
          </div>
        </div>
      )}

      {showSmart && (
        <SmartPlaylistEditor
          existing={showSmart === "new" ? undefined : showSmart}
          onClose={() => setShowSmart(null)} />
      )}

      {(tab === "all" || tab === "playlists") && (
        <section className="mb-8">
          <div className={view === "grid" ? "flex flex-wrap gap-4" : "space-y-2"}>
            <button onClick={() => setShowCreate(true)}
              className="bg-card rounded-lg p-3 card-hover w-40 sm:w-44 md:w-48 flex flex-col items-center justify-center aspect-[4/5]">
              <Plus className="w-12 h-12 text-secondary mb-2" />
              <span className="font-semibold text-sm">Create Playlist</span>
            </button>
            <Link href="/library?tab=songs" onClick={() => setTab("songs")}
              className="bg-gradient-to-br from-purple-600 to-blue-700 rounded-lg p-3 w-40 sm:w-44 md:w-48 flex flex-col justify-end aspect-[4/5] hover:scale-[1.02] transition">
              <Heart className="w-10 h-10 text-white mb-2" />
              <div className="font-semibold text-sm">Liked Songs</div>
              <div className="text-xs text-white/80">{likedIds.length} songs</div>
            </Link>
            <button onClick={() => { const ids = topPlayed(50); const songs = ids.map((id) => cache[id]).filter(Boolean) as Song[]; if (songs.length) player.playList(songs, 0, "Most Played"); }}
              className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-3 w-40 sm:w-44 md:w-48 flex flex-col justify-end aspect-[4/5] hover:scale-[1.02] transition text-left">
              <Flame className="w-10 h-10 text-white mb-2" />
              <div className="font-semibold text-sm">Most Played</div>
              <div className="text-xs text-white/80">Top 50</div>
            </button>
            <Link href="/history" className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg p-3 w-40 sm:w-44 md:w-48 flex flex-col justify-end aspect-[4/5] hover:scale-[1.02] transition">
              <Clock className="w-10 h-10 text-white mb-2" />
              <div className="font-semibold text-sm">Recently Played</div>
            </Link>
            {userPlaylists
              .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
              .map((p) => (
                <div key={p.id} className="relative group">
                  <UserPlaylistCard playlist={p} />
                  <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) deletePlaylist(p.id); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/80">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
            ))}
          </div>
        </section>
      )}

      {(tab === "all" || tab === "songs") && filteredLiked.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">Liked Songs</h2>
            <button onClick={() => player.playList(shuf(filteredLiked), 0, "Liked Songs")} className="text-xs px-3 py-1.5 bg-accent text-black rounded-full font-semibold flex items-center gap-1">
              <Shuffle className="w-3 h-3" /> Shuffle
            </button>
          </div>
          <div>{filteredLiked.slice(0, tab === "songs" ? 1000 : 10).map((s, i) => <SongRow key={s.id} song={s} index={i} queue={filteredLiked} />)}</div>
        </section>
      )}

      {(tab === "all" || tab === "albums") && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Saved Albums</h2>
          {savedAlbumsData.length === 0 ? (
            <div className="text-secondary text-sm">No saved albums yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {savedAlbumsData.map((a) => <AlbumCard key={a.id} album={a} />)}
            </div>
          )}
        </section>
      )}

      {(tab === "all" || tab === "artists") && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Followed Artists</h2>
          {followedData.length === 0 ? (
            <div className="text-secondary text-sm">No followed artists yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {followedData.map((a) => <ArtistCard key={a.id} artist={a} />)}
            </div>
          )}
        </section>
      )}

      {(tab === "all" || tab === "downloads") && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">Downloaded</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-secondary">{downloadedSongs.length} songs • {totalMB()} MB{isIOS() ? " / 50 MB" : ""}</span>
              {downloadedSongs.length > 0 && (
                <button onClick={deleteAllDownloads} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 rounded-full">Delete all</button>
              )}
            </div>
          </div>
          {downloadedSongs.length === 0 ? (
            <div className="text-center text-secondary py-12">
              <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No downloads yet — download songs for offline playback
            </div>
          ) : (
            <div>{downloadedSongs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={downloadedSongs} />)}</div>
          )}
        </section>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Create Playlist</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
            </div>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Playlist name"
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent mb-3" />
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
