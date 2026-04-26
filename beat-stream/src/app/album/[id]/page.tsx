"use client";
import { use, useEffect, useState } from "react";
import { Play, Shuffle, Heart, Loader2, Download, MoreHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { Album } from "@/lib/types";
import { decodeHtml, fmtDuration, pickImage, shuffle as shuf } from "@/lib/utils";
import { extractDominantColor } from "@/lib/colorExtract";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { SongRow } from "@/components/SongRow";
import { songCache } from "@/lib/storage";
import { useCached, TTL } from "@/lib/cache";

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: album, isLoading } = useCached<Album>(`album:${id}`, TTL.album, () => api.getAlbum(id));
  const [bgColor, setBgColor] = useState("#1f1f1f");
  const player = usePlayer();
  const { isSavedAlbum, toggleSavedAlbum } = useLibrary();
  const { toast } = useToast();

  useEffect(() => {
    if (album?.songs) songCache.putMany(album.songs);
    if (album) extractDominantColor(pickImage(album.image, "high")).then(setBgColor);
  }, [album]);

  if (isLoading && !album) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }
  if (!album) return <div className="p-8 text-center text-secondary">Album not found</div>;

  const songs = album.songs || [];
  const totalDuration = songs.reduce((sum, s) => sum + (typeof s.duration === "string" ? parseInt(s.duration, 10) : (s.duration || 0)), 0);
  const saved = isSavedAlbum(album.id);

  return (
    <div className="fade-in">
      <div className="relative" style={{ background: `linear-gradient(180deg, ${bgColor} 0%, transparent 100%)` }}>
        <div className="px-4 md:px-8 lg:px-12 pt-12 pb-6 flex flex-col md:flex-row gap-8 items-end">
          <img src={pickImage(album.image, "high")} alt="" className="w-56 h-56 md:w-64 md:h-64 rounded-lg art-glow object-cover" style={{ ["--glow-color" as string]: "rgba(0,0,0,0.5)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase font-bold tracking-widest text-white/80">Album</div>
            <h1 className="text-4xl md:text-7xl font-extrabold mt-2 tracking-tight drop-shadow-lg leading-none">{decodeHtml(album.name)}</h1>
            {album.description && <p className="text-white/70 text-sm mt-3 line-clamp-2 max-w-2xl">{decodeHtml(album.description)}</p>}
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-white/80 mt-4">
              <span className="font-bold text-white">{album.artists?.primary?.map((a) => a.name).join(", ")}</span>
              {album.year && <><span>•</span><span>{album.year}</span></>}
              <span>•</span><span>{songs.length} songs, {fmtDuration(totalDuration)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 py-6 flex items-center gap-6 relative" style={{ background: `linear-gradient(180deg, ${bgColor}40, transparent)` }}>
        <button onClick={() => songs.length && player.playList(songs, 0, `Album · ${album.name}`)} className="btn-icon-large" aria-label="Play album">
          <Play className="w-7 h-7 fill-black ml-1" />
        </button>
        <button onClick={() => songs.length && player.playList(shuf(songs), 0, `Album · ${album.name}`)} className="text-white/70 hover:text-white p-2" aria-label="Shuffle">
          <Shuffle className="w-7 h-7" />
        </button>
        <button onClick={() => { const a = toggleSavedAlbum(album.id); toast(a ? "Added to your library" : "Removed", a ? "success" : "info"); }} className="p-2" aria-label={saved ? "Remove" : "Save"}>
          <Heart className={`w-8 h-8 ${saved ? "fill-accent text-accent" : "text-white/70 hover:text-white"}`} />
        </button>
        <button className="text-white/70 hover:text-white p-2" aria-label="More"><MoreHorizontal className="w-7 h-7" /></button>
      </div>

      <div className="px-4 md:px-8 lg:px-12 pb-12">
        <div className="border-b border-white/10 pb-2 mb-2 px-2 text-[11px] text-secondary uppercase tracking-widest font-bold flex items-center gap-3">
          <span className="w-8 text-center">#</span>
          <span className="w-11" />
          <span className="flex-1">Title</span>
          <span className="w-12 text-right hidden sm:block">Duration</span>
        </div>
        {songs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} showAlbum={false} />)}
      </div>
    </div>
  );
}
