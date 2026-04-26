"use client";
import { useState } from "react";
import Link from "next/link";
import { Play, Pause, Heart, MoreHorizontal, Check, Headphones, Calendar, Disc3, Languages, Star } from "lucide-react";
import type { Song } from "@/lib/types";
import { artistsName, decodeHtml, fmtTime, pickImage } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { useSettings } from "@/contexts/SettingsContext";
import { prefetch } from "@/lib/prefetch";
import { ratings } from "@/lib/storage";
import { SongMenu } from "./SongMenu";

/** Format big play counts: 12345678 → "12.3M". */
function fmtPlays(n: number | string | undefined): string {
  const v = typeof n === "string" ? parseInt(n, 10) : (n || 0);
  if (!v || !isFinite(v)) return "";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

export function SongRow({ song, index, queue, showAlbum = true }: { song: Song; index?: number; queue?: Song[]; showAlbum?: boolean }) {
  const { currentSong, isPlaying, togglePlay, playSong, playList } = usePlayer();
  const { isLiked, toggleLike, downloadIds } = useLibrary();
  const { settings } = useSettings();
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
  const plays = fmtPlays((song as any).playCount);
  const year = song.year;
  const isYouTube = song.source === "youtube" && !(song.id || "").startsWith("itunes:");
  const isItunes = (song.id || "").startsWith("itunes:");
  const userRating = typeof window !== "undefined" ? ratings.get(song.id) : 0;
  const lang = (song.language || "").toLowerCase();

  return (
    <div
      onMouseEnter={() => {
        prefetch.songAndAudioStart(song.id, settings.quality);
        if (song.album?.id) prefetch.album(song.album.id);
        if (song.artists?.primary?.[0]?.id) prefetch.artist(song.artists.primary[0].id);
      }}
      onTouchStart={() => prefetch.songAndAudioStart(song.id, settings.quality)}
      className={`group flex items-center gap-3 px-2 py-2.5 rounded-md transition hover:bg-white/[0.06] ${isCurrent ? "bg-white/[0.04]" : ""}`}
    >
      <div className="w-8 text-center text-secondary text-sm relative flex items-center justify-center">
        {isCurrent ? (
          <div className={`equalizer group-hover:hidden ${isPlaying ? "" : "paused"}`}><span /><span /><span /><span /></div>
        ) : (
          <span className="group-hover:hidden tabular-nums">{index != null ? index + 1 : "•"}</span>
        )}
        <button onClick={handlePlay} className="hidden group-hover:flex items-center justify-center text-white" aria-label={isCurrent && isPlaying ? "Pause" : "Play"}>
          {isCurrent && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </button>
      </div>

      <button onClick={handlePlay} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <img src={pickImage(song.image, "low")} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0 shadow-md" loading="lazy" />
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className={`text-sm font-semibold line-clamp-1 ${isCurrent ? "text-accent" : "text-white"}`}>
            {decodeHtml(song.name)}
            {song.explicitContent && <span className="ml-2 text-[10px] bg-white/15 text-secondary px-1.5 py-0.5 rounded font-bold">E</span>}
            {isDownloaded && <span title="Downloaded for offline" className="inline-flex items-center justify-center ml-2 w-4 h-4 rounded-full bg-accent/20"><Check className="w-2.5 h-2.5 text-accent" strokeWidth={3} /></span>}
            {userRating > 0 && <span className="ml-2 inline-flex items-center gap-0.5 text-yellow-400 text-[10px]"><Star className="w-3 h-3 fill-yellow-400" />{userRating}</span>}
          </div>

          {/* Artist line */}
          <div className="text-xs text-secondary line-clamp-1 mt-0.5">
            {song.artists?.primary?.map((a, i) => (
              <span key={a.id}>
                <Link href={`/artist/${a.id}`} className="hover:text-white hover:underline" onClick={(e) => e.stopPropagation()}>
                  {a.name}
                </Link>
                {i < (song.artists?.primary?.length || 0) - 1 && ", "}
              </span>
            ))}
          </div>

          {/* Stats row — small, dim, single line; scrolls on overflow */}
          <div className="flex items-center gap-2.5 mt-1 text-[10.5px] text-secondary/80 overflow-x-auto no-scrollbar">
            {plays && (
              <span className="inline-flex items-center gap-1 bg-accent/10 text-accent/90 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                <Headphones className="w-2.5 h-2.5" /> {plays}
              </span>
            )}
            {year && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Calendar className="w-2.5 h-2.5" /> {year}
              </span>
            )}
            {lang && (
              <span className="inline-flex items-center gap-1 capitalize whitespace-nowrap">
                <Languages className="w-2.5 h-2.5" /> {lang}
              </span>
            )}
            {showAlbum && song.album?.name && (
              <Link
                href={`/album/${song.album.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 hover:text-white hover:underline whitespace-nowrap min-w-0"
              >
                <Disc3 className="w-2.5 h-2.5 flex-shrink-0" /> <span className="truncate max-w-[180px]">{decodeHtml(song.album.name)}</span>
              </Link>
            )}
            {isItunes && <span className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider whitespace-nowrap">iTunes</span>}
            {isYouTube && <span className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider whitespace-nowrap">YouTube</span>}
          </div>
        </div>
      </button>

      <button
        onClick={() => {
          const added = toggleLike(song.id);
          toast(added ? "Added to Liked Songs" : "Removed from Liked Songs", added ? "success" : "info");
        }}
        className={`p-2 transition ${liked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        aria-label="Like"
      >
        <Heart className={`w-4 h-4 ${liked ? "fill-accent text-accent scale-bounce" : "text-secondary hover:text-white"}`} />
      </button>
      <span className="text-xs text-secondary tabular-nums w-12 text-right hidden sm:block">{fmtTime(dur)}</span>
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="p-2 opacity-0 group-hover:opacity-100 text-secondary hover:text-white transition"
          aria-label="More"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && <SongMenu song={song} onClose={() => setMenuOpen(false)} />}
      </div>
    </div>
  );
}
