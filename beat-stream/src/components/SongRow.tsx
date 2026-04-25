"use client";
import { useState } from "react";
import Link from "next/link";
import { Play, Pause, Heart, MoreHorizontal, Download, Check } from "lucide-react";
import type { Song } from "@/lib/types";
import { artistsName, decodeHtml, fmtTime, pickImage } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { SongMenu } from "./SongMenu";

export function SongRow({ song, index, queue, showAlbum = true }: { song: Song; index?: number; queue?: Song[]; showAlbum?: boolean }) {
  const { currentSong, isPlaying, togglePlay, playSong, playList } = usePlayer();
  const { isLiked, toggleLike, downloadIds } = useLibrary();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const liked = isLiked(song.id);
  const isCurrent = currentSong?.id === song.id;
  const isDownloaded = downloadIds.includes(song.id);

  function handlePlay() {
    if (isCurrent) togglePlay();
    else if (queue) playList(queue, queue.findIndex((s) => s.id === song.id));
    else playSong(song);
  }

  const dur = typeof song.duration === "string" ? parseInt(song.duration, 10) : (song.duration || 0);

  return (
    <div className={`group flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 ${isCurrent ? "text-accent" : ""}`}>
      <div className="w-8 text-center text-secondary text-sm relative">
        <span className="group-hover:hidden">{index != null ? index + 1 : "•"}</span>
        <button onClick={handlePlay} className="hidden group-hover:flex items-center justify-center text-white">
          {isCurrent && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>
      </div>
      <img src={pickImage(song.image, "low")} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" onClick={handlePlay} />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlay}>
        <div className={`text-sm font-semibold line-clamp-1 ${isCurrent ? "text-accent" : "text-white"}`}>
          {decodeHtml(song.name)}
          {song.explicitContent && <span className="ml-2 text-[10px] bg-white/15 text-secondary px-1 rounded">E</span>}
          {isDownloaded && <Check className="inline w-3 h-3 ml-2 text-accent" />}
        </div>
        <div className="text-xs text-secondary line-clamp-1">
          {song.artists?.primary?.map((a, i) => (
            <span key={a.id}>
              <Link href={`/artist/${a.id}`} className="hover:text-white hover:underline" onClick={(e) => e.stopPropagation()}>
                {a.name}
              </Link>
              {i < (song.artists?.primary?.length || 0) - 1 && ", "}
            </span>
          ))}
        </div>
      </div>
      {showAlbum && song.album?.name && (
        <Link href={`/album/${song.album.id}`} className="hidden md:block text-sm text-secondary hover:text-white hover:underline w-44 line-clamp-1">
          {decodeHtml(song.album.name)}
        </Link>
      )}
      <button
        onClick={() => {
          const added = toggleLike(song.id);
          toast(added ? "Added to Liked Songs" : "Removed from Liked Songs", added ? "success" : "info");
        }}
        className={`p-2 ${liked ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition`}
      >
        <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : "text-secondary hover:text-white"}`} />
      </button>
      <span className="text-xs text-secondary w-12 text-right hidden sm:block">{fmtTime(dur)}</span>
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="p-2 opacity-0 group-hover:opacity-100 text-secondary hover:text-white transition"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && <SongMenu song={song} onClose={() => setMenuOpen(false)} />}
      </div>
    </div>
  );
}
