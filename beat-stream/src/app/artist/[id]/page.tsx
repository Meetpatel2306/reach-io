"use client";
import { use, useEffect, useState } from "react";
import { Play, Loader2, BadgeCheck, UserPlus, UserCheck, Radio, ChevronDown } from "lucide-react";
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
import { useCached, cached, TTL } from "@/lib/cache";

// Initial fetch grabs 5 pages of songs (~50 tracks) and 3 pages of albums (~30
// albums) in parallel — Saavn paginates aggressively so a single page only
// returns ~10 items. "Load more" extends from there.
const INITIAL_SONG_PAGES = [0, 1, 2, 3, 4];
const INITIAL_ALBUM_PAGES = [0, 1, 2];
const LOAD_MORE_PAGES_AT_A_TIME = 5;

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: bundle, isLoading } = useCached<{
    artist: Artist;
    songs: Song[];
    albums: Album[];
    songTotal: number;
    albumTotal: number;
  }>(`artist-deep:${id}`, TTL.artist, async () => {
    const [a, songPages, albumPages] = await Promise.all([
      api.getArtist(id),
      Promise.all(INITIAL_SONG_PAGES.map((p) =>
        cached(`artist-songs:${id}:${p}`, TTL.artist, () => api.getArtistSongs(id, p))
          .catch(() => ({ songs: [] as Song[], total: 0 }))
      )),
      Promise.all(INITIAL_ALBUM_PAGES.map((p) =>
        cached(`artist-albums:${id}:${p}`, TTL.artist, () => api.getArtistAlbums(id, p))
          .catch(() => ({ albums: [] as Album[], total: 0 }))
      )),
    ]);
    // Merge + dedupe songs across pages
    const songMap = new Map<string, Song>();
    if (a.topSongs) for (const s of a.topSongs) songMap.set(s.id, s);
    for (const page of songPages) for (const s of (page.songs || [])) songMap.set(s.id, s);
    // Same for albums
    const albumMap = new Map<string, Album>();
    if (a.topAlbums) for (const al of a.topAlbums) albumMap.set(al.id, al);
    for (const page of albumPages) for (const al of (page.albums || [])) albumMap.set(al.id, al);
    return {
      artist: a,
      songs: Array.from(songMap.values()),
      albums: Array.from(albumMap.values()),
      songTotal: songPages[0]?.total || songMap.size,
      albumTotal: albumPages[0]?.total || albumMap.size,
    };
  });

  const artist = bundle?.artist || null;
  const initialSongs = bundle?.songs || [];
  const initialAlbums = bundle?.albums || [];
  const songTotal = bundle?.songTotal || 0;
  const albumTotal = bundle?.albumTotal || 0;

  // Extra pages loaded via "Load more"
  const [extraSongs, setExtraSongs] = useState<Song[]>([]);
  const [extraAlbums, setExtraAlbums] = useState<Album[]>([]);
  const [songCursor, setSongCursor] = useState(INITIAL_SONG_PAGES.length);
  const [albumCursor, setAlbumCursor] = useState(INITIAL_ALBUM_PAGES.length);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  const [loadingMoreAlbums, setLoadingMoreAlbums] = useState(false);

  // Reset extras when navigating between artists
  useEffect(() => {
    setExtraSongs([]); setExtraAlbums([]);
    setSongCursor(INITIAL_SONG_PAGES.length);
    setAlbumCursor(INITIAL_ALBUM_PAGES.length);
  }, [id]);

  const songs = (() => {
    const seen = new Set<string>();
    const out: Song[] = [];
    for (const s of [...initialSongs, ...extraSongs]) {
      if (s?.id && !seen.has(s.id)) { seen.add(s.id); out.push(s); }
    }
    return out;
  })();

  const albums = (() => {
    const seen = new Set<string>();
    const out: Album[] = [];
    for (const al of [...initialAlbums, ...extraAlbums]) {
      if (al?.id && !seen.has(al.id)) { seen.add(al.id); out.push(al); }
    }
    return out;
  })();

  const [showAllSongs, setShowAllSongs] = useState(true);
  const player = usePlayer();
  const { isFollowedArtist, toggleFollowedArtist } = useLibrary();
  const { toast } = useToast();

  useEffect(() => { if (songs.length) songCache.putMany(songs); }, [songs.length]);

  async function loadMoreSongs() {
    if (loadingMoreSongs) return;
    setLoadingMoreSongs(true);
    const pages = Array.from({ length: LOAD_MORE_PAGES_AT_A_TIME }, (_, i) => songCursor + i);
    const results = await Promise.all(pages.map((p) =>
      cached(`artist-songs:${id}:${p}`, TTL.artist, () => api.getArtistSongs(id, p))
        .catch(() => ({ songs: [] as Song[], total: 0 }))
    ));
    const newOnes = results.flatMap((r) => r.songs || []);
    setExtraSongs((prev) => [...prev, ...newOnes]);
    setSongCursor((c) => c + LOAD_MORE_PAGES_AT_A_TIME);
    setLoadingMoreSongs(false);
    if (!newOnes.length) toast("No more songs", "info");
  }

  async function loadMoreAlbums() {
    if (loadingMoreAlbums) return;
    setLoadingMoreAlbums(true);
    const pages = Array.from({ length: LOAD_MORE_PAGES_AT_A_TIME }, (_, i) => albumCursor + i);
    const results = await Promise.all(pages.map((p) =>
      cached(`artist-albums:${id}:${p}`, TTL.artist, () => api.getArtistAlbums(id, p))
        .catch(() => ({ albums: [] as Album[], total: 0 }))
    ));
    const newOnes = results.flatMap((r) => r.albums || []);
    setExtraAlbums((prev) => [...prev, ...newOnes]);
    setAlbumCursor((c) => c + LOAD_MORE_PAGES_AT_A_TIME);
    setLoadingMoreAlbums(false);
    if (!newOnes.length) toast("No more albums", "info");
  }

  if (isLoading && !artist) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!artist) return <div className="p-8 text-center text-secondary">Artist not found</div>;

  const followed = isFollowedArtist(artist.id);
  const visibleSongs = showAllSongs ? songs : songs.slice(0, 10);
  const bio = Array.isArray(artist.bio) ? artist.bio.map((b) => b.text).join("\n\n") : artist.bio;
  const moreSongsAvailable = songTotal === 0 || songs.length < songTotal;
  const moreAlbumsAvailable = albumTotal === 0 || albums.length < albumTotal;

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

      <div className="px-4 md:px-8 lg:px-12 py-6 flex items-center gap-6 flex-wrap">
        <button onClick={() => songs.length && player.playList(songs, 0, artist.name)} className="btn-icon-large" aria-label="Play">
          <Play className="w-7 h-7 fill-black ml-1" />
        </button>
        <button onClick={() => { const a = toggleFollowedArtist(artist.id); toast(a ? `Following ${artist.name}` : `Unfollowed`, a ? "success" : "info"); }}
          className={`px-6 py-2 rounded-full font-bold text-sm border-2 transition flex items-center gap-2 ${followed ? "border-white/30 text-white hover:border-white/60" : "border-white text-white hover:scale-105"}`}>
          {followed ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
        </button>
        <button
          onClick={() => songs.length && player.playList(songs, 0, `${artist.name} Radio`)}
          className="px-5 py-2 rounded-full font-semibold text-sm bg-white/10 hover:bg-white/20 transition flex items-center gap-2"
          title="Start an endless radio of similar songs"
        >
          <Radio className="w-4 h-4" /> Start Radio
        </button>
      </div>

      {songs.length > 0 && (
        <section className="px-4 md:px-8 lg:px-12 mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="section-title">Songs</h2>
            <span className="text-xs text-secondary">
              {songs.length}{songTotal > 0 ? ` of ${songTotal}` : ""}
            </span>
          </div>
          <div>{visibleSongs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} />)}</div>
          <div className="flex items-center gap-3 mt-3">
            {songs.length > 10 && (
              <button onClick={() => setShowAllSongs(!showAllSongs)} className="text-sm text-secondary hover:text-white font-bold uppercase tracking-wider">
                {showAllSongs ? "Show less" : "See all"}
              </button>
            )}
            {moreSongsAvailable && (
              <button onClick={loadMoreSongs} disabled={loadingMoreSongs}
                className="text-sm bg-card hover:bg-card-hover px-4 py-2 rounded-full font-semibold flex items-center gap-2">
                {loadingMoreSongs ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                Load more songs
              </button>
            )}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section className="px-4 md:px-8 lg:px-12 mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="section-title">Discography</h2>
            <span className="text-xs text-secondary">
              {albums.length}{albumTotal > 0 ? ` of ${albumTotal}` : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((a) => <AlbumCard key={a.id} album={a} />)}
          </div>
          {moreAlbumsAvailable && (
            <button onClick={loadMoreAlbums} disabled={loadingMoreAlbums}
              className="mt-4 text-sm bg-card hover:bg-card-hover px-4 py-2 rounded-full font-semibold flex items-center gap-2">
              {loadingMoreAlbums ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
              Load more albums
            </button>
          )}
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
