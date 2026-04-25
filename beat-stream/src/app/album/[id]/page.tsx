"use client";
import { use, useEffect, useState } from "react";
import { Play, Shuffle, Heart, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Album } from "@/lib/types";
import { decodeHtml, fmtDuration, pickImage, shuffle as shuf } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { SongRow } from "@/components/SongRow";
import { songCache } from "@/lib/storage";

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const player = usePlayer();
  const { isSavedAlbum, toggleSavedAlbum } = useLibrary();
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    api.getAlbum(id).then((a) => {
      setAlbum(a);
      if (a.songs) songCache.putMany(a.songs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }
  if (!album) return <div className="p-8 text-center text-secondary">Album not found</div>;

  const songs = album.songs || [];
  const totalDuration = songs.reduce((sum, s) => sum + (typeof s.duration === "string" ? parseInt(s.duration, 10) : (s.duration || 0)), 0);
  const saved = isSavedAlbum(album.id);

  return (
    <div className="fade-in">
      <div className="relative">
        <div
          className="absolute inset-0 h-72 opacity-50"
          style={{
            backgroundImage: `url(${pickImage(album.image, "high")})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px)",
          }}
        />
        <div className="absolute inset-0 h-72 bg-gradient-to-b from-transparent to-bg" />
        <div className="relative px-4 md:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-6 items-end">
          <img src={pickImage(album.image, "high")} alt="" className="w-48 h-48 md:w-56 md:h-56 rounded-md shadow-2xl object-cover" />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase font-semibold text-secondary">Album</div>
            <h1 className="text-3xl md:text-5xl font-bold mt-2">{decodeHtml(album.name)}</h1>
            <p className="text-secondary mt-3 text-sm">
              {album.artists?.primary?.map((a) => a.name).join(", ")} • {album.year} • {songs.length} songs • {fmtDuration(totalDuration)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => songs.length && player.playList(songs, 0)}
          className="bg-accent text-black rounded-full p-4 hover:scale-105 transition shadow-lg"
        >
          <Play className="w-6 h-6 fill-black ml-0.5" />
        </button>
        <button
          onClick={() => songs.length && player.playList(shuf(songs), 0)}
          className="text-secondary hover:text-white p-2"
          title="Shuffle"
        >
          <Shuffle className="w-6 h-6" />
        </button>
        <button
          onClick={() => {
            const added = toggleSavedAlbum(album.id);
            toast(added ? "Added to your library" : "Removed from library", added ? "success" : "info");
          }}
          className="p-2"
          title={saved ? "Remove from library" : "Save to library"}
        >
          <Heart className={`w-6 h-6 ${saved ? "fill-accent text-accent" : "text-secondary hover:text-white"}`} />
        </button>
      </div>

      <div className="px-4 md:px-6 lg:px-8 pb-8">
        <div className="border-b border-white/5 pb-2 mb-2 px-2 text-xs text-secondary uppercase grid grid-cols-[2rem_2.5rem_1fr_auto_3rem] sm:grid-cols-[2rem_2.5rem_1fr_11rem_auto_3rem] gap-3">
          <span>#</span>
          <span></span>
          <span>Title</span>
          <span className="hidden md:block">Album</span>
          <span></span>
          <span className="hidden sm:block">Time</span>
        </div>
        {songs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} showAlbum={false} />)}
      </div>
    </div>
  );
}
