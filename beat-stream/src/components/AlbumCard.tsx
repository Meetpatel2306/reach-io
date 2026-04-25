"use client";
import Link from "next/link";
import { Play } from "lucide-react";
import type { Album } from "@/lib/types";
import { decodeHtml, pickImage } from "@/lib/utils";

export function AlbumCard({ album }: { album: Album }) {
  return (
    <Link
      href={`/album/${album.id}`}
      className="group relative bg-card rounded-lg p-3 card-hover w-40 sm:w-44 md:w-48 block"
    >
      <div className="relative">
        <img
          src={pickImage(album.image, "med")}
          alt=""
          className="w-full aspect-square rounded-md object-cover shadow-lg"
        />
        <div className="absolute bottom-2 right-2 bg-accent rounded-full p-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition shadow-xl">
          <Play className="w-5 h-5 fill-black text-black" />
        </div>
      </div>
      <div className="mt-3">
        <div className="font-semibold text-sm line-clamp-1">{decodeHtml(album.name)}</div>
        <div className="text-xs text-secondary line-clamp-2 mt-1">
          {album.artists?.primary?.map((a) => a.name).join(", ") || album.year}
        </div>
      </div>
    </Link>
  );
}
