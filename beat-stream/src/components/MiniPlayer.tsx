"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, Heart, ChevronUp } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { artistsName, decodeHtml, pickImage } from "@/lib/utils";
import { extractDominantColor } from "@/lib/colorExtract";

export function MiniPlayer() {
  const { currentSong, isPlaying, togglePlay, next, prev, progress, buffered, duration, expanded, setExpanded } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();
  const { toast } = useToast();
  const [bg, setBg] = useState("rgba(40,40,40,1)");
  const startX = useRef(0);
  const startY = useRef(0);
  const swiped = useRef(false);

  useEffect(() => {
    if (!currentSong) return;
    extractDominantColor(pickImage(currentSong.image, "med")).then((hex) => {
      setBg(hex);
    });
  }, [currentSong?.id]);

  if (!currentSong || expanded) return null;
  const liked = isLiked(currentSong.id);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiped.current = false;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (Math.abs(dy) > 50 && dy < 0) { setExpanded(true); swiped.current = true; return; }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
      swiped.current = true;
    }
  }

  return (
    <div
      className="fixed left-2 right-2 md:left-64 md:right-2 lg:left-72 z-30 touch-pan-y"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 56px)" }}
    >
      <div
        className="rounded-xl shadow-2xl overflow-hidden cursor-pointer transition-all"
        style={{
          background: `linear-gradient(135deg, ${bg} 0%, #1a1a1a 75%)`,
          boxShadow: "0 12px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
        onClick={() => { if (!swiped.current) setExpanded(true); }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="h-1 bg-white/10 relative overflow-hidden">
          {/* Buffered (lighter — Spotify-style "loaded ahead" indicator) */}
          <div
            className="absolute top-0 left-0 h-full bg-white/40 transition-all duration-300"
            style={{ width: `${duration ? Math.min(100, (buffered / duration) * 100) : 0}%` }}
          />
          {/* Played (sits on top, accent color) */}
          <div
            className="absolute top-0 left-0 h-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%`, boxShadow: "0 0 8px rgba(var(--accent-rgb), 0.6)" }}
          />
        </div>
        <div className="flex items-center gap-3 p-2.5 md:p-3">
          <div className="relative">
            <img src={pickImage(currentSong.image, "med")} alt="" className="w-12 h-12 md:w-14 md:h-14 rounded-md object-cover flex-shrink-0 shadow-lg" />
            <ChevronUp className="absolute -top-1 -right-1 w-3.5 h-3.5 text-white/60 md:hidden" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm line-clamp-1 text-white">{decodeHtml(currentSong.name)}</div>
            <div className="text-xs text-white/70 line-clamp-1 mt-0.5">{decodeHtml(artistsName(currentSong))}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const added = toggleLike(currentSong.id);
              toast(added ? "Added to Liked Songs" : "Removed from Liked Songs", added ? "success" : "info");
            }}
            className="p-2 hidden sm:block"
            aria-label="Like"
          >
            <Heart className={`w-5 h-5 ${liked ? "fill-accent text-accent scale-bounce" : "text-white/70 hover:text-white"}`} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-2 text-white" aria-label="Play/Pause">
            {isPlaying ? <Pause className="w-7 h-7 fill-white" /> : <Play className="w-7 h-7 fill-white ml-0.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="p-2 text-white/80 hover:text-white hidden sm:block" aria-label="Next">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
