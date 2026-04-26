"use client";
import { Play, Pause } from "lucide-react";
import type { Song } from "@/lib/types";
import { artistsName, decodeHtml, pickImage } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { prefetch, usePrefetchOnVisible } from "@/lib/prefetch";

export function SongCard({ song, queue }: { song: Song; queue?: Song[] }) {
  const { playList, playSong, currentSong, isPlaying, togglePlay } = usePlayer();
  const { settings } = useSettings();
  const isCurrent = currentSong?.id === song.id;
  const ref = usePrefetchOnVisible(() => prefetch.image(pickImage(song.image, "med")), [song.id]);

  function handle() {
    if (isCurrent) togglePlay();
    else if (queue) playList(queue, queue.findIndex((s) => s.id === song.id));
    else playSong(song);
  }

  function preWarm() {
    prefetch.songAndAudioStart(song.id, settings.quality);
    if (song.album?.id) prefetch.album(song.album.id);
    if (song.artists?.primary?.[0]?.id) prefetch.artist(song.artists.primary[0].id);
  }

  return (
    <button
      onClick={handle}
      ref={ref as any}
      onMouseEnter={preWarm}
      onTouchStart={preWarm}
      className="premium-card text-left w-40 sm:w-44 md:w-48 group"
    >
      <div className="card-art-wrap">
        <img src={pickImage(song.image, "med")} alt="" className="card-art" loading="lazy" />
        <div className="play-fab">
          {isCurrent && isPlaying ? <Pause className="w-5 h-5 fill-black text-black" /> : <Play className="w-5 h-5 fill-black text-black ml-0.5" />}
        </div>
      </div>
      <div className="mt-3 px-1">
        <div className="font-semibold text-sm line-clamp-1 flex items-center gap-2">
          {isCurrent && <div className={`equalizer ${isPlaying ? "" : "paused"}`}><span /><span /><span /></div>}
          <span className={`line-clamp-1 ${isCurrent ? "text-accent" : ""}`}>{decodeHtml(song.name)}</span>
        </div>
        <div className="text-xs text-secondary line-clamp-2 mt-1">{decodeHtml(artistsName(song))}</div>
      </div>
    </button>
  );
}
