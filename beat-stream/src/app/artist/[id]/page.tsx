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

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const player = usePlayer();
  const { isFollowedArtist, toggleFollowedArtist } = useLibrary();
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getArtist(id),
      api.getArtistSongs(id, 0).catch(() => ({ songs: [] as Song[], total: 0 })),
      api.getArtistAlbums(id, 0).catch(() => ({ albums: [] as Album[], total: 0 })),
    ]).then(([a, s, al]) => {
      setArtist(a);
      const allSongs = a.topSongs?.length ? a.topSongs : s.songs;
      setSongs(allSongs);
      songCache.putMany(allSongs);
      setAlbums(a.topAlbums?.length ? a.topAlbums : al.albums);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!artist) return <div className="p-8 text-center text-secondary">Artist not found</div>;

  const followed = isFollowedArtist(artist.id);
  const visibleSongs = showAllSongs ? songs : songs.slice(0, 10);
  const bio = Array.isArray(artist.bio) ? artist.bio.map((b) => b.text).join("\n\n") : artist.bio;

  return (
    <div className="fade-in">
      <div className="relative h-72 md:h-96 overflow-hidden">
        <img src={pickImage(artist.image, "high")} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-bg" />
        <div className="absolute bottom-6 left-4 md:left-8">
          {artist.isVerified && (
            <div className="flex items-center gap-1 text-sm mb-2 text-blue-400">
              <BadgeCheck className="w-4 h-4 fill-blue-400 text-white" /> Verified Artist
            </div>
          )}
          <h1 className="text-4xl md:text-6xl font-bold drop-shadow-2xl">{decodeHtml(artist.name)}</h1>
          {artist.fanCount && (
            <p className="text-secondary mt-2 text-sm">{artist.fanCount} listeners</p>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => songs.length && player.playList(songs, 0)}
          className="bg-accent text-black rounded-full p-4 hover:scale-105 transition shadow-lg"
        >
          <Play className="w-6 h-6 fill-black ml-0.5" />
        </button>
        <button
          onClick={() => {
            const added = toggleFollowedArtist(artist.id);
            toast(added ? `Following ${artist.name}` : `Unfollowed ${artist.name}`, added ? "success" : "info");
          }}
          className={`px-5 py-2 rounded-full font-semibold text-sm border transition flex items-center gap-2 ${followed ? "border-white/30 text-white" : "border-white text-white hover:bg-white hover:text-black"}`}
        >
          {followed ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
        </button>
      </div>

      {songs.length > 0 && (
        <section className="px-4 md:px-6 lg:px-8 mb-8">
          <h2 className="text-xl font-bold mb-3">Popular</h2>
          <div>{visibleSongs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} />)}</div>
          {songs.length > 10 && (
            <button onClick={() => setShowAllSongs(!showAllSongs)} className="text-sm text-secondary hover:text-white mt-2 font-semibold">
              {showAllSongs ? "Show less" : "Show more"}
            </button>
          )}
        </section>
      )}

      {albums.length > 0 && (
        <section className="px-4 md:px-6 lg:px-8 mb-8">
          <h2 className="text-xl font-bold mb-3">Albums</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {albums.map((a) => <AlbumCard key={a.id} album={a} />)}
          </div>
        </section>
      )}

      {artist.singles && artist.singles.length > 0 && (
        <section className="px-4 md:px-6 lg:px-8 mb-8">
          <h2 className="text-xl font-bold mb-3">Singles & EPs</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {(artist.singles as Song[]).map((s) => (
              <div key={s.id} className="w-40 sm:w-44 md:w-48 bg-card rounded-lg p-3 card-hover" onClick={() => player.playSong(s)}>
                <img src={pickImage(s.image, "med")} className="w-full aspect-square rounded-md object-cover" alt="" />
                <div className="text-sm font-semibold mt-3 line-clamp-1">{decodeHtml(s.name)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {artist.similarArtists && artist.similarArtists.length > 0 && (
        <section className="px-4 md:px-6 lg:px-8 mb-8">
          <h2 className="text-xl font-bold mb-3">Fans Also Like</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {artist.similarArtists.map((a) => <ArtistCard key={a.id} artist={a} />)}
          </div>
        </section>
      )}

      {bio && (
        <section className="px-4 md:px-6 lg:px-8 mb-12">
          <h2 className="text-xl font-bold mb-3">About</h2>
          <p className="text-secondary text-sm whitespace-pre-line max-w-3xl">{bio}</p>
        </section>
      )}
    </div>
  );
}
