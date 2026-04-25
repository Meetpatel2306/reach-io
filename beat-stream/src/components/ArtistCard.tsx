"use client";
import Link from "next/link";
import type { Artist } from "@/lib/types";
import { decodeHtml, pickImage } from "@/lib/utils";

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link
      href={`/artist/${artist.id}`}
      className="group bg-card rounded-lg p-3 card-hover w-40 sm:w-44 md:w-48 block text-center"
    >
      <img
        src={pickImage(artist.image, "med")}
        alt=""
        className="w-full aspect-square rounded-full object-cover shadow-lg"
      />
      <div className="mt-3">
        <div className="font-semibold text-sm line-clamp-1">{decodeHtml(artist.name)}</div>
        <div className="text-xs text-secondary mt-1">Artist</div>
      </div>
    </Link>
  );
}
