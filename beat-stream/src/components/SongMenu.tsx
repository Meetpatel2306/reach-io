"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, ListPlus, Plus, User, Download, Share2, Check, Trash2 } from "lucide-react";
import type { Song } from "@/lib/types";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { useSettings } from "@/contexts/SettingsContext";
import { artistsName, pickDownloadUrl } from "@/lib/utils";
import { downloadAudio, audioCache } from "@/lib/audioCache";
import { downloads } from "@/lib/storage";
import { PlaylistPickerModal } from "./PlaylistPickerModal";

export function SongMenu({ song, onClose }: { song: Song; onClose: () => void }) {
  const player = usePlayer();
  const { downloadIds, refreshDownloads } = useLibrary();
  const { settings } = useSettings();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const isDownloaded = downloadIds.includes(song.id);

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
      } catch {
        toast("Download failed", "error");
      }
    }
    onClose();
  }

  function handleShare() {
    const data = { title: song.name, text: `${song.name} — ${artistsName(song)}`, url: song.url || "" };
    if (navigator.share) navigator.share(data).catch(() => {});
    else { navigator.clipboard.writeText(data.url); toast("Link copied", "success"); }
    onClose();
  }

  const item = "w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-white/10 text-sm rounded";

  return (
    <>
      <div
        ref={ref}
        className="absolute right-0 top-full mt-1 z-50 bg-[#222] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[200px]"
      >
        <button className={item} onClick={() => { player.playNext(song); toast("Playing next", "success"); onClose(); }}>
          <Play className="w-4 h-4" /> Play Next
        </button>
        <button className={item} onClick={() => { player.addToQueue(song); toast("Added to Queue", "success"); onClose(); }}>
          <ListPlus className="w-4 h-4" /> Add to Queue
        </button>
        <button className={item} onClick={() => { setShowPicker(true); }}>
          <Plus className="w-4 h-4" /> Add to Playlist
        </button>
        {song.artists?.primary?.[0] && (
          <Link href={`/artist/${song.artists.primary[0].id}`} className={item} onClick={onClose}>
            <User className="w-4 h-4" /> Go to Artist
          </Link>
        )}
        <button className={item} onClick={handleDownload}>
          {isDownloaded ? <Trash2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {isDownloaded ? "Remove Download" : "Download"}
        </button>
        <button className={item} onClick={handleShare}>
          <Share2 className="w-4 h-4" /> Share
        </button>
      </div>
      {showPicker && <PlaylistPickerModal song={song} onClose={() => { setShowPicker(false); onClose(); }} />}
    </>
  );
}
