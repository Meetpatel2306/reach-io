"use client";
import { use, useEffect, useState } from "react";
import { Play, Loader2, BadgeCheck, UserPlus, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { Artist, Song, Album } from "@/lib/types";
import { decodeHtml, pickImage } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { SongRow } from "@/components/SongRow";
import { AlbumCard } from "@/components/AlbumCard";
import { ArtistCard } from "@/components/ArtistCard";
import { songCache } from "@/lib/storage";
import { useCached, TTL } from "@/lib/cache";

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: bundle, isLoading } = useCached<{ artist: Artist; songs: Song[]; albums: Album[] }>(`artist:${id}`, TTL.artist, async () => {
    const [a, s, al] = await Promise.all([
      api.getArtist(id),
      api.getArtistSongs(id, 0).catch(() => ({ songs: [] as Song[], total: 0 })),
      api.getArtistAlbums(id, 0).catch(() => ({ albums: [] as Album[], total: 0 })),
    ]);
    const allSongs = a.topSongs?.length ? a.topSongs : s.songs;
    return { artist: a, songs: allSongs, albums: a.topAlbums?.length ? a.topAlbums : al.albums };
  });
  const artist = bundle?.artist || null;
  const songs = bundle?.songs || [];
  const albums = bundle?.albums || [];
  const [showAllSongs, setShowAllSongs] = useState(false);
  const player = usePlayer();
  const { isFollowedArtist, toggleFollowedArtist } = useLibrary();
  const { toast } = useToast();

  useEffect(() => { if (songs.length) songCache.putMany(songs); }, [songs]);

  if (isLoading && !artist) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!artist) return <div className="p-8 text-center text-secondary">Artist not found</div>;

  const followed = isFollowedArtist(artist.id);
  const visibleSongs = showAllSongs ? songs : songs.slice(0, 10);
  const bio = Array.isArray(artist.bio) ? artist.bio.map((b) => b.text).join("\n\n") : artist.bio;

  return (
    <div className="fade-in">
      <div className="relative h-72 md:h-[420px] overflow-hidden -mx-4 md:-mx-6 lg:-mx-8 -mt-6">
        <img src={pickImage(artist.image, "high")} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-bg" />
        <div className="absolute bottom-6 left-4 md:left-12 right-4 md:right-12">
          {artist.isVerified && (
            <div className="flex items-center gap-1.5 text-sm mb-3 text-blue-400 font-semibold">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><BadgeCheck className="w-3.5 h-3.5 text-white fill-blue-500" /></div>
              <span>Verified Artist</span>
            </div>
          )}
          <h1 className="text-5xl md:text-8xl font-extrabold drop-shadow-2xl tracking-tight leading-none">{decodeHtml(artist.name)}</h1>
          {artist.fanCount && (
            <p className="text-white/80 mt-3 text-sm">{artist.fanCount} monthly listeners</p>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 py-6 flex items-center gap-6">
        <button onClick={() => songs.length && player.playList(songs, 0, artist.name)} className="btn-icon-large" aria-label="Play">
          <Play className="w-7 h-7 fill-black ml-1" />
        </button>
        <button onClick={() => { const a = toggleFollowedArtist(artist.id); toast(a ? `Following ${artist.name}` : `Unfollowed`, a ? "success" : "info"); }}
          className={`px-6 py-2 rounded-full font-bold text-sm border-2 transition flex items-center gap-2 ${followed ? "border-white/30 text-white hover:border-white/60" : "border-white text-white hover:scale-105"}`}>
          {followed ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
        </button>
      </div>

      {songs.length > 0 && (
        <section className="px-4 md:px-8 lg:px-12 mb-10">
          <h2 className="section-title mb-3">Popular</h2>
          <div>{visibleSongs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} />)}</div>
          {songs.length > 10 && (
            <button onClick={() => setShowAllSongs(!showAllSongs)} className="text-sm text-secondary hover:text-white mt-3 font-bold uppercase tracking-wider">
              {showAllSongs ? "Show less" : "See more"}
            </button>
          )}
        </section>
      )}

      {albums.length > 0 && (
        <section className="px-4 md:px-8 lg:px-12 mb-10">
          <h2 className="section-title mb-4">Discography</h2>
          <div className="h-scroll no-scrollbar">
            {albums.map((a) => <AlbumCard key={a.id} album={a} />)}
          </div>
        </section>
      )}

      {artist.singles && artist.singles.length > 0 && (
        <section className="px-4 md:px-8 lg:px-12 mb-10">
          <h2 className="section-title mb-4">Singles & EPs</h2>
          <div className="h-scroll no-scrollbar">
            {(artist.singles as Song[]).map((s) => (
              <button key={s.id} onClick={() => player.playSong(s)} className="premium-card w-40 sm:w-44 md:w-48 text-left group">
                <div className="card-art-wrap">
                  <img src={pickImage(s.image, "med")} className="card-art" alt="" loading="lazy" />
                  <div className="play-fab"><Play className="w-5 h-5 fill-black ml-0.5" /></div>
                </div>
                <div className="text-sm font-semibold mt-3 line-clamp-1 px-1">{decodeHtml(s.name)}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {artist.similarArtists && artist.similarArtists.length > 0 && (
        <section className="px-4 md:px-8 lg:px-12 mb-10">
          <h2 className="section-title mb-4">Fans also like</h2>
          <div className="h-scroll no-scrollbar">
            {artist.similarArtists.map((a) => <ArtistCard key={a.id} artist={a} />)}
          </div>
        </section>
      )}

      {bio && (
        <section className="px-4 md:px-8 lg:px-12 mb-12">
          <h2 className="section-title mb-3">About</h2>
          <div className="bg-card rounded-2xl p-6 max-w-3xl">
            <p className="text-secondary text-sm whitespace-pre-line">{bio}</p>
          </div>
        </section>
      )}
    </div>
  );
}
