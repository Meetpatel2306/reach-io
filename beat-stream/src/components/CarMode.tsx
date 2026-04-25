"use client";
import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { artistsName, decodeHtml, pickImage } from "@/lib/utils";

export function CarMode() {
  const player = usePlayer();
  if (!player.showCarMode) return null;
  const song = player.currentSong;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-6 fade-in" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <button
        onClick={() => player.setShowCarMode(false)}
        className="absolute top-4 right-4 p-3 bg-white/10 rounded-full hover:bg-white/20"
        style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
        aria-label="Exit car mode"
      >
        <X className="w-7 h-7" />
      </button>

      {song ? (
        <>
          <img src={pickImage(song.image, "high")} alt="" className="w-64 h-64 md:w-80 md:h-80 rounded-2xl object-cover shadow-2xl mb-8" />
          <div className="text-center max-w-2xl mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">{decodeHtml(song.name)}</h1>
            <p className="text-2xl md:text-3xl text-secondary">{decodeHtml(artistsName(song))}</p>
          </div>

          <div className="flex items-center gap-8 md:gap-16">
            <button onClick={player.prev} className="p-6 bg-white/10 hover:bg-white/20 rounded-full transition active:scale-95" aria-label="Previous">
              <SkipBack className="w-12 h-12 fill-white" />
            </button>
            <button onClick={player.togglePlay} className="bg-white text-black rounded-full p-8 hover:scale-105 transition shadow-2xl active:scale-95" aria-label="Play/Pause">
              {player.isPlaying ? <Pause className="w-16 h-16 fill-black" /> : <Play className="w-16 h-16 fill-black ml-1" />}
            </button>
            <button onClick={player.next} className="p-6 bg-white/10 hover:bg-white/20 rounded-full transition active:scale-95" aria-label="Next">
              <SkipForward className="w-12 h-12 fill-white" />
            </button>
          </div>
        </>
      ) : (
        <div className="text-2xl text-secondary">No song playing</div>
      )}
    </div>
  );
}
