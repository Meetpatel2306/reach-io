"use client";
import { useRef } from "react";
import { Play, Pause, SkipForward, Heart } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { artistsName, decodeHtml, pickImage } from "@/lib/utils";

export function MiniPlayer() {
  const { currentSong, isPlaying, togglePlay, next, prev, progress, expanded, setExpanded } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();
  const { toast } = useToast();
  const startX = useRef(0);
  const startY = useRef(0);
  const swiped = useRef(false);

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
        className="bg-[#282828] rounded-xl shadow-2xl overflow-hidden cursor-pointer hover:bg-[#333] transition md:rounded-xl"
        onClick={(e) => { if (!swiped.current) setExpanded(true); }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="h-0.5 bg-white/10 relative">
          <div className="absolute top-0 left-0 h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-3 p-2 md:p-3">
          <img src={pickImage(currentSong.image, "med")} alt="" className="w-12 h-12 md:w-14 md:h-14 rounded-md object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm line-clamp-1">{decodeHtml(currentSong.name)}</div>
            <div className="text-xs text-secondary line-clamp-1">{decodeHtml(artistsName(currentSong))}</div>
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
            <Heart className={`w-5 h-5 ${liked ? "fill-accent text-accent scale-bounce" : "text-secondary hover:text-white"}`} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-2 text-white hover:scale-110 transition" aria-label="Play/Pause">
            {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="p-2 text-secondary hover:text-white" aria-label="Next">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
