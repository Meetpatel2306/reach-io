"use client";
import { use, useEffect, useState } from "react";
import { Play, Shuffle, Heart, Loader2, MoreHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { Playlist } from "@/lib/types";
import { decodeHtml, fmtDuration, pickImage, shuffle as shuf } from "@/lib/utils";
import { extractDominantColor } from "@/lib/colorExtract";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { SongRow } from "@/components/SongRow";
import { songCache } from "@/lib/storage";
import { useCached, TTL } from "@/lib/cache";

export default function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: playlist, isLoading } = useCached<Playlist>(`playlist:${id}`, TTL.playlist, () => api.getPlaylist(id));
  const [bgColor, setBgColor] = useState("#1f1f1f");
  const player = usePlayer();
  const { isSavedPlaylist, toggleSavedPlaylist } = useLibrary();
  const { toast } = useToast();

  useEffect(() => {
    if (playlist?.songs) songCache.putMany(playlist.songs);
    if (playlist) extractDominantColor(pickImage(playlist.image, "high")).then(setBgColor);
  }, [playlist]);

  if (isLoading && !playlist) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!playlist) return <div className="p-8 text-center text-secondary">Playlist not found</div>;

  const songs = playlist.songs || [];
  const totalDuration = songs.reduce((sum, s) => sum + (typeof s.duration === "string" ? parseInt(s.duration, 10) : (s.duration || 0)), 0);
  const saved = isSavedPlaylist(playlist.id);

  return (
    <div className="fade-in">
      <div className="relative" style={{ background: `linear-gradient(180deg, ${bgColor} 0%, transparent 100%)` }}>
        <div className="px-4 md:px-8 lg:px-12 pt-12 pb-6 flex flex-col md:flex-row gap-8 items-end">
          <img src={pickImage(playlist.image, "high")} alt="" className="w-56 h-56 md:w-64 md:h-64 rounded-lg art-glow object-cover" />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase font-bold tracking-widest text-white/80">Playlist</div>
            <h1 className="text-4xl md:text-7xl font-extrabold mt-2 tracking-tight drop-shadow-lg leading-none">{decodeHtml(playlist.name)}</h1>
            {playlist.description && <p className="text-white/70 text-sm mt-3 line-clamp-2 max-w-2xl">{decodeHtml(playlist.description)}</p>}
            <div className="text-sm text-white/80 mt-4">{songs.length} songs, {fmtDuration(totalDuration)}</div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 py-6 flex items-center gap-6" style={{ background: `linear-gradient(180deg, ${bgColor}40, transparent)` }}>
        <button onClick={() => songs.length && player.playList(songs, 0, `Playlist · ${playlist.name}`)} className="btn-icon-large" aria-label="Play">
          <Play className="w-7 h-7 fill-black ml-1" />
        </button>
        <button onClick={() => songs.length && player.playList(shuf(songs), 0, `Playlist · ${playlist.name}`)} className="text-white/70 hover:text-white p-2" aria-label="Shuffle">
          <Shuffle className="w-7 h-7" />
        </button>
        <button onClick={() => { const a = toggleSavedPlaylist(playlist.id); toast(a ? "Saved" : "Removed", a ? "success" : "info"); }} className="p-2" aria-label="Save">
          <Heart className={`w-8 h-8 ${saved ? "fill-accent text-accent" : "text-white/70 hover:text-white"}`} />
        </button>
        <button className="text-white/70 hover:text-white p-2"><MoreHorizontal className="w-7 h-7" /></button>
      </div>

      <div className="px-4 md:px-8 lg:px-12 pb-12">
        {songs.map((s, i) => <SongRow key={`${s.id}-${i}`} song={s} index={i} queue={songs} />)}
      </div>
    </div>
  );
}
