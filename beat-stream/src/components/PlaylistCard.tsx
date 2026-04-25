"use client";
import Link from "next/link";
import { Play, ListMusic } from "lucide-react";
import type { Playlist, UserPlaylist } from "@/lib/types";
import { decodeHtml, pickImage } from "@/lib/utils";

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className="group bg-card rounded-lg p-3 card-hover w-40 sm:w-44 md:w-48 block"
    >
      <div className="relative">
        <img
          src={pickImage(playlist.image, "med")}
          alt=""
          className="w-full aspect-square rounded-md object-cover shadow-lg"
        />
        <div className="absolute bottom-2 right-2 bg-accent rounded-full p-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition shadow-xl">
          <Play className="w-5 h-5 fill-black text-black" />
        </div>
      </div>
      <div className="mt-3">
        <div className="font-semibold text-sm line-clamp-1">{decodeHtml(playlist.name)}</div>
        <div className="text-xs text-secondary line-clamp-2 mt-1">{decodeHtml(playlist.description || "")}</div>
      </div>
    </Link>
  );
}

export function UserPlaylistCard({ playlist }: { playlist: UserPlaylist }) {
  return (
    <Link
      href={`/playlist/user/${playlist.id}`}
      className="group bg-card rounded-lg p-3 card-hover w-40 sm:w-44 md:w-48 block"
    >
      <div className="w-full aspect-square rounded-md bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
        <ListMusic className="w-12 h-12 text-white/80" />
      </div>
      <div className="mt-3">
        <div className="font-semibold text-sm line-clamp-1">{playlist.name}</div>
        <div className="text-xs text-secondary mt-1">{playlist.songIds.length} songs</div>
      </div>
    </Link>
  );
}
