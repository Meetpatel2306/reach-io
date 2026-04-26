"use client";
import Link from "next/link";
import { Play } from "lucide-react";
import type { Album } from "@/lib/types";
import { decodeHtml, pickImage } from "@/lib/utils";
import { prefetch, usePrefetchOnVisible } from "@/lib/prefetch";

export function AlbumCard({ album }: { album: Album }) {
  const ref = usePrefetchOnVisible(() => {
    prefetch.image(pickImage(album.image, "med"));
  }, [album.id]);

  return (
    <Link
      href={`/album/${album.id}`}
      ref={ref as any}
      onMouseEnter={() => prefetch.album(album.id)}
      onTouchStart={() => prefetch.album(album.id)}
      className="premium-card w-40 sm:w-44 md:w-48 block group"
    >
      <div className="card-art-wrap">
        <img src={pickImage(album.image, "med")} alt="" className="card-art" loading="lazy" />
        <div className="play-fab"><Play className="w-5 h-5 fill-black text-black ml-0.5" /></div>
      </div>
      <div className="mt-3 px-1">
        <div className="font-semibold text-sm line-clamp-1">{decodeHtml(album.name)}</div>
        <div className="text-xs text-secondary line-clamp-2 mt-1">
          {album.year ? <span>{album.year}</span> : null}
          {album.year && album.artists?.primary?.[0]?.name ? <span> • </span> : null}
          <span>{album.artists?.primary?.map((a) => a.name).join(", ")}</span>
        </div>
      </div>
    </Link>
  );
}
