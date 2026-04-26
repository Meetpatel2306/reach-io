"use client";
import Link from "next/link";
import type { Artist } from "@/lib/types";
import { decodeHtml, pickImage } from "@/lib/utils";
import { prefetch, usePrefetchOnVisible } from "@/lib/prefetch";

export function ArtistCard({ artist }: { artist: Artist }) {
  const ref = usePrefetchOnVisible(() => prefetch.image(pickImage(artist.image, "med")), [artist.id]);
  return (
    <Link
      href={`/artist/${artist.id}`}
      ref={ref as any}
      onMouseEnter={() => prefetch.artist(artist.id)}
      onTouchStart={() => prefetch.artist(artist.id)}
      className="premium-card w-40 sm:w-44 md:w-48 block text-center group"
    >
      <div className="relative aspect-square rounded-full overflow-hidden shadow-2xl">
        <img src={pickImage(artist.image, "med")} alt="" className="card-art rounded-full" loading="lazy" />
      </div>
      <div className="mt-3 px-1">
        <div className="font-semibold text-sm line-clamp-1">{decodeHtml(artist.name)}</div>
        <div className="text-xs text-secondary mt-1">Artist</div>
      </div>
    </Link>
  );
}
