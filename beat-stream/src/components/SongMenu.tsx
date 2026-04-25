"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, ListPlus, Plus, User, Disc3, Download, Share2, Trash2, Heart, Ban, Radio } from "lucide-react";
import type { Song } from "@/lib/types";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { useSettings } from "@/contexts/SettingsContext";
import { artistsName, pickDownloadUrl } from "@/lib/utils";
import { downloadAudio, audioCache } from "@/lib/audioCache";
import { downloads } from "@/lib/storage";
import { api } from "@/lib/api";
import { PlaylistPickerModal } from "./PlaylistPickerModal";

export function SongMenu({ song, onClose }: { song: Song; onClose: () => void }) {
  const player = usePlayer();
  const { downloadIds, refreshDownloads, isLiked, toggleLike, toggleBlockSong, isBlockedSong } = useLibrary();
  const { settings } = useSettings();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const isDownloaded = downloadIds.includes(song.id);
  const liked = isLiked(song.id);
  const blocked = isBlockedSong(song.id);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  async function handleDownload() {
    if (isDownloaded) {
      await audioCache.remove(song.id);
      downloads.remove(song.id);
      refreshDownloads();
      toast("Removed download", "info");
    } else {
      const url = pickDownloadUrl(song, settings.downloadQuality);
      if (!url) { toast("No download URL", "error"); return; }
      try {
        const blob = await downloadAudio(url, song.id);
        downloads.add({ songId: song.id, quality: settings.downloadQuality, cachedAt: Date.now(), size: blob.size });
        refreshDownloads();
        toast("Downloaded for offline", "success");
      } catch { toast("Download failed", "error"); }
    }
    onClose();
  }

  function handleShare() {
    const data = { title: song.name, text: `${song.name} — ${artistsName(song)}`, url: song.url || "" };
    if (navigator.share) navigator.share(data).catch(() => {});
    else { navigator.clipboard.writeText(`${song.name} — ${artistsName(song)}`); toast("Copied to clipboard!", "success"); }
    onClose();
  }

  async function startSongRadio() {
    onClose();
    toast("Building song radio...", "info");
    try {
      const artistName = song.artists?.primary?.[0]?.name || song.name;
      const res = await api.searchSongs(artistName, 0, 30);
      const filtered = res.results.filter((s) => s.id !== song.id);
      if (!filtered.length) { toast("No similar songs found", "error"); return; }
      player.playList([song, ...filtered], 0, `${song.name} Radio`);
    } catch { toast("Couldn't start radio", "error"); }
  }

  const item = "w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-white/10 text-sm rounded";

  return (
    <>
      <div
        ref={ref}
        className="absolute right-0 top-full mt-1 z-50 bg-[#222] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[220px]"
      >
        <button className={item} onClick={() => { player.playSong(song); onClose(); }}>
          <Play className="w-4 h-4" /> Play
        </button>
        <button className={item} onClick={() => { player.playNext(song); toast("Playing next", "success"); onClose(); }}>
          <Play className="w-4 h-4" /> Play Next
        </button>
        <button className={item} onClick={() => { player.addToQueue(song); toast("Added to Queue", "success"); onClose(); }}>
          <ListPlus className="w-4 h-4" /> Add to Queue
        </button>
        <button className={item} onClick={() => setShowPicker(true)}>
          <Plus className="w-4 h-4" /> Add to Playlist
        </button>
        {song.album?.id && (
          <Link href={`/album/${song.album.id}`} className={item} onClick={onClose}>
            <Disc3 className="w-4 h-4" /> Go to Album
          </Link>
        )}
        {song.artists?.primary?.[0] && (
          <Link href={`/artist/${song.artists.primary[0].id}`} className={item} onClick={onClose}>
            <User className="w-4 h-4" /> Go to Artist
          </Link>
        )}
        <button className={item} onClick={() => { const a = toggleLike(song.id); toast(a ? "Added to Liked Songs" : "Removed from Liked Songs", a ? "success" : "info"); onClose(); }}>
          <Heart className={`w-4 h-4 ${liked ? "fill-accent text-accent" : ""}`} /> {liked ? "Unlike" : "Like"}
        </button>
        <button className={item} onClick={handleDownload}>
          {isDownloaded ? <Trash2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {isDownloaded ? "Remove Download" : "Download"}
        </button>
        <button className={item} onClick={startSongRadio}>
          <Radio className="w-4 h-4" /> Go to Song Radio
        </button>
        <button className={item} onClick={handleShare}>
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button className={item} onClick={() => { const a = toggleBlockSong(song.id); toast(a ? "Blocked — won't play" : "Unblocked", a ? "info" : "success"); onClose(); }}>
          <Ban className="w-4 h-4" /> {blocked ? "Unblock" : "Don't Play This"}
        </button>
      </div>
      {showPicker && <PlaylistPickerModal song={song} onClose={() => { setShowPicker(false); onClose(); }} />}
    </>
  );
}
