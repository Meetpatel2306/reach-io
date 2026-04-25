"use client";
import { Play, Pause, SkipForward, Heart } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { artistsName, pickImage } from "@/lib/utils";

export function MiniPlayer() {
  const { currentSong, isPlaying, togglePlay, next, progress, expanded, setExpanded } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();
  const { toast } = useToast();

  if (!currentSong || expanded) return null;

  const liked = isLiked(currentSong.id);

  return (
    <div className="fixed bottom-12 md:bottom-2 left-2 right-2 md:left-64 md:right-2 lg:left-72 z-30">
      <div
        className="bg-card rounded-xl shadow-2xl overflow-hidden cursor-pointer hover:bg-card-hover transition"
        onClick={() => setExpanded(true)}
      >
        <div className="h-1 bg-white/5 relative">
          <div className="absolute top-0 left-0 h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-3 p-2 md:p-3">
          <img
            src={pickImage(currentSong.image, "med")}
            alt=""
            className="w-12 h-12 md:w-14 md:h-14 rounded-md object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm line-clamp-1">{currentSong.name}</div>
            <div className="text-xs text-secondary line-clamp-1">{artistsName(currentSong)}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const added = toggleLike(currentSong.id);
              toast(added ? "Added to Liked Songs" : "Removed from Liked Songs", added ? "success" : "info");
            }}
            className="p-2 hidden sm:block"
          >
            <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : "text-secondary hover:text-white"}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="p-2 text-white hover:scale-110 transition"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="p-2 text-secondary hover:text-white"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
