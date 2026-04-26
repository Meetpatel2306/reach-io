"use client";
import Link from "next/link";
import { Play, ListMusic } from "lucide-react";
import type { Playlist, UserPlaylist } from "@/lib/types";
import { decodeHtml, pickImage } from "@/lib/utils";
import { prefetch, usePrefetchOnVisible } from "@/lib/prefetch";

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const ref = usePrefetchOnVisible(() => prefetch.image(pickImage(playlist.image, "med")), [playlist.id]);
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      ref={ref as any}
      onMouseEnter={() => prefetch.playlist(playlist.id)}
      onTouchStart={() => prefetch.playlist(playlist.id)}
      className="premium-card w-40 sm:w-44 md:w-48 block group"
    >
      <div className="card-art-wrap">
        <img src={pickImage(playlist.image, "med")} alt="" className="card-art" loading="lazy" />
        <div className="play-fab"><Play className="w-5 h-5 fill-black text-black ml-0.5" /></div>
      </div>
      <div className="mt-3 px-1">
        <div className="font-semibold text-sm line-clamp-1">{decodeHtml(playlist.name)}</div>
        <div className="text-xs text-secondary line-clamp-2 mt-1">{decodeHtml(playlist.description || "Playlist")}</div>
      </div>
    </Link>
  );
}

export function UserPlaylistCard({ playlist }: { playlist: UserPlaylist }) {
  return (
    <Link href={`/playlist/user/${playlist.id}`} className="premium-card w-40 sm:w-44 md:w-48 block group">
      <div className="w-full aspect-square rounded-md bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-2xl relative overflow-hidden">
        <ListMusic className="w-14 h-14 text-white/90 drop-shadow-lg" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10" />
      </div>
      <div className="mt-3 px-1">
        <div className="font-semibold text-sm line-clamp-1">{playlist.name}</div>
        <div className="text-xs text-secondary mt-1">{playlist.songIds.length} songs</div>
      </div>
    </Link>
  );
}
