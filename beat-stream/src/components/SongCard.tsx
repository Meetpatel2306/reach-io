"use client";
import { Play } from "lucide-react";
import type { Song } from "@/lib/types";
import { artistsName, decodeHtml, pickImage } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";

export function SongCard({ song, queue }: { song: Song; queue?: Song[] }) {
  const player = usePlayer();
  return (
    <button
      onClick={() => queue ? player.playList(queue, queue.findIndex((s) => s.id === song.id)) : player.playSong(song)}
      className="group relative bg-card rounded-lg p-3 card-hover text-left w-40 sm:w-44 md:w-48"
    >
      <div className="relative">
        <img
          src={pickImage(song.image, "med")}
          alt=""
          className="w-full aspect-square rounded-md object-cover shadow-lg"
        />
        <div className="absolute bottom-2 right-2 bg-accent rounded-full p-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition shadow-xl">
          <Play className="w-5 h-5 fill-black text-black" />
        </div>
      </div>
      <div className="mt-3">
        <div className="font-semibold text-sm line-clamp-1">{decodeHtml(song.name)}</div>
        <div className="text-xs text-secondary line-clamp-2 mt-1">{decodeHtml(artistsName(song))}</div>
      </div>
    </button>
  );
}
