"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, X, Mic, Loader2, Play, Quote } from "lucide-react";
import { api } from "@/lib/api";
import type { Album, Artist, Playlist, Song } from "@/lib/types";
import { searches } from "@/lib/storage";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/contexts/ToastContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { decodeHtml, pickImage, artistsName } from "@/lib/utils";
import { rankSongs } from "@/lib/rank";
import { cached, TTL } from "@/lib/cache";
import { smartSearchFast, enrichSearch, peekSearch } from "@/lib/smartSearch";
import { searchByLyric } from "@/lib/lyricSearch";
import { SongRow } from "@/components/SongRow";
import { AlbumCard } from "@/components/AlbumCard";
import { ArtistCard } from "@/components/ArtistCard";
import { PlaylistCard } from "@/components/PlaylistCard";

type Tab = "all" | "songs" | "albums" | "artists" | "playlists" | "lyrics";

interface LyricMatch { trackName: string; artistName: string; albumName?: string; snippet?: string; }

const TRENDING = ["Arijit Singh", "Diljit Dosanjh", "Drake", "Taylor Swift", "Pritam", "AP Dhillon", "The Weeknd", "Karan Aujla", "Anirudh", "Atif Aslam", "Shreya Ghoshal", "Badshah"];

const BROWSE = [
  { name: "Hindi", color: "from-orange-500 to-red-600" },
  { name: "English", color: "from-blue-500 to-purple-600" },
  { name: "Punjabi", color: "from-yellow-500 to-orange-600" },
  { name: "Tamil", color: "from-emerald-500 to-teal-600" },
  { name: "Romantic", color: "from-pink-500 to-rose-600" },
  { name: "Party", color: "from-purple-500 to-pink-600" },
  { name: "Workout", color: "from-red-500 to-orange-600" },
  { name: "Chill", color: "from-teal-500 to-cyan-600" },
];

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const debounced = useDebounce(query, 300);
  const [tab, setTab] = useState<Tab>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [lyricMatches, setLyricMatches] = useState<LyricMatch[]>([]);
  // Subset of `songs` that smartSearch surfaced via LRCLIB lyric matching
  const [lyricFoundIds, setLyricFoundIds] = useState<string[]>([]);
  const [didYouMean, setDidYouMean] = useState<{ name: string; query: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const player = usePlayer();
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => { setRecent(searches.list()); }, []);

  useEffect(() => {
    if (!debounced.trim()) {
      setSongs([]); setAlbums([]); setArtists([]); setPlaylists([]); setHasMore(false); setError(null);
      setLyricFoundIds([]);
      setDidYouMean(null);
      return;
    }
    let cancelled = false;
    // 0) If we have a fully-cached bundle, render it INSTANTLY (no spinner).
    const cachedBundle = peekSearch(debounced);
    if (cachedBundle) {
      setSongs(cachedBundle.songs);
      setAlbums(cachedBundle.albums);
      setArtists(cachedBundle.artists);
      setPlaylists(cachedBundle.playlists);
      setLyricFoundIds(cachedBundle.lyricFound || []);
      setHasMore(cachedBundle.songs.length >= 30);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    setPage(0);

    // 1) FAST phase — 4 parallel calls, ~200ms when API is healthy
    smartSearchFast(debounced).then((bundle) => {
      if (cancelled) return;
      const empty = bundle.songs.length === 0 && bundle.albums.length === 0 && bundle.artists.length === 0 && bundle.playlists.length === 0;
      if (empty) {
        api.searchSongs("a", 0, 1).then(() => {}).catch(() => {
          if (!cancelled) setError("Couldn't reach the music API. Check Settings → About → API Mirror.");
        });
      }
      setSongs(bundle.songs);
      setAlbums(bundle.albums);
      setArtists(bundle.artists);
      setPlaylists(bundle.playlists);
      setLyricFoundIds(bundle.lyricFound || []);
      setHasMore(bundle.songs.length >= 30);
      setLoading(false);

      // 2) ENRICH phase — fires lyrics/album-expansion/YT/typo-fuzzy/artist
      // discography in background and updates the songs list as each source lands.
      enrichSearch(debounced, bundle, (next) => {
        if (cancelled) return;
        setSongs(next.songs);
        setLyricFoundIds(next.lyricFound || []);
        if (next.didYouMean) setDidYouMean(next.didYouMean);
      });
    }).catch(() => {
      if (cancelled) return;
      setError("Search failed. Try again or switch API mirror in Settings → About.");
      setLoading(false);
    });

    // Dedicated Lyrics tab still gets its own LRCLIB query for snippet display
    cached(`lyric-search:${debounced.toLowerCase()}`, TTL.search, () => searchByLyric(debounced, 12))
      .then((m) => { if (!cancelled) setLyricMatches(m); }).catch(() => { if (!cancelled) setLyricMatches([]); });

    return () => { cancelled = true; };
  }, [debounced]);

  function submit(q: string) {
    if (!q.trim()) return;
    searches.push(q);
    setRecent(searches.list());
    setQuery(q);
    router.replace(`/search?q=${encodeURIComponent(q)}`);
  }

  async function loadMore() {
    if (loading || !hasMore || !debounced) return;
    setLoading(true);
    const next = page + 1;
    const r = await cached(`search:${debounced.toLowerCase()}:p${next}`, TTL.search,
      () => api.searchSongs(debounced, next, 20)).catch(() => null);
    if (r) {
      setSongs((s) => rankSongs([...s, ...r.results], debounced));
      setHasMore(r.results.length >= 20);
      setPage(next);
    }
    setLoading(false);
  }

  function startVoice() {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { toast("Voice search not supported", "error"); return; }
    if (!recognitionRef.current) recognitionRef.current = new SR();
    const r = recognitionRef.current;
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e: any) => { setListening(false); submit(e.results[0][0].transcript); };
    r.onerror = () => { setListening(false); toast("Voice search error", "error"); };
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "songs", label: "Songs" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
    { key: "playlists", label: "Playlists" },
    { key: "lyrics", label: "Lyrics" },
  ];

  // Top result: prefer top artist if exact-ish match, else first song
  const topResult = (() => {
    if (!query) return null;
    const q = query.toLowerCase();
    const a = artists.find((ar) => ar.name?.toLowerCase().includes(q));
    if (a) return { type: "artist" as const, item: a };
    if (songs[0]) return { type: "song" as const, item: songs[0] };
    return null;
  })();

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <div className="max-w-3xl mx-auto mb-6 sticky top-0 z-10 bg-bg/90 backdrop-blur py-2">
        <div className="relative">
          <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            id="global-search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(query)}
            placeholder="What do you want to listen to?"
            className="w-full bg-white text-black rounded-full pl-12 pr-24 py-3 text-base outline-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            {query && (
              <button onClick={() => setQuery("")} className="p-2 text-gray-500 hover:text-black"><X className="w-4 h-4" /></button>
            )}
            <button onClick={startVoice} className={`p-2 ${listening ? "text-accent animate-pulse" : "text-gray-500 hover:text-accent"}`}>
              <Mic className="w-5 h-5" />
            </button>
          </div>
        </div>
        {listening && <div className="text-center text-accent text-sm mt-2 animate-pulse">Listening...</div>}
      </div>

      {!query && (
        <div className="max-w-4xl mx-auto space-y-8">
          {recent.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Recent searches</h2>
                <button onClick={() => { searches.clear(); setRecent([]); }} className="text-xs text-secondary hover:text-white">Clear all</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((q) => (
                  <span key={q} className="inline-flex items-center gap-1 bg-card hover:bg-card-hover rounded-full pl-3 pr-1 py-1 text-sm">
                    <button onClick={() => submit(q)}>{q}</button>
                    <button onClick={() => { searches.remove(q); setRecent(searches.list()); }} className="text-secondary hover:text-white p-1"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-bold mb-3">Trending searches</h2>
            <div className="flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <button key={t} onClick={() => submit(t)} className="bg-card hover:bg-card-hover rounded-full px-4 py-1.5 text-sm">{t}</button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Browse all</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {BROWSE.map((b) => (
                <Link key={b.name} href={`/search?q=${encodeURIComponent(b.name + " hits")}`}
                  className={`aspect-square rounded-xl bg-gradient-to-br ${b.color} p-4 hover:scale-[1.03] transition flex items-end`}>
                  <span className="font-bold text-base">{b.name}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {query && (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${tab === t.key ? "bg-white text-black" : "bg-card text-secondary hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-4 mb-6 text-sm">
              {error}
            </div>
          )}
          {didYouMean && didYouMean.query.toLowerCase() !== query.toLowerCase() && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 mb-4 text-sm flex items-center gap-3">
              <span className="text-secondary">Did you mean</span>
              <button onClick={() => submit(didYouMean.query)} className="font-bold text-accent hover:underline">{didYouMean.name}</button>
              <span className="text-secondary">?</span>
            </div>
          )}
          {!error && !loading && songs.length === 0 && albums.length === 0 && artists.length === 0 && playlists.length === 0 && (
            <div className="text-center py-16 text-secondary">
              <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div className="text-lg font-semibold text-white">No results found for "{query}"</div>
              <div className="text-sm mt-2">Try one of these:</div>
              <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-lg mx-auto">
                {(() => {
                  const tokens = query.split(/\s+/).filter((t) => t.length > 1);
                  const suggestions: string[] = [];
                  if (tokens.length > 1) {
                    suggestions.push(tokens[0]);
                    suggestions.push(tokens[tokens.length - 1]);
                  }
                  if (/^the\s/i.test(query)) suggestions.push(query.replace(/^the\s+/i, ""));
                  suggestions.push(query.replace(/[^\w\s]/g, "").trim());
                  const seen = new Set<string>();
                  return Array.from(new Set(suggestions))
                    .filter((s) => s && s.toLowerCase() !== query.toLowerCase() && !seen.has(s) && (seen.add(s), true))
                    .slice(0, 5)
                    .map((s) => (
                      <button key={s} onClick={() => submit(s)} className="bg-card hover:bg-card-hover rounded-full px-4 py-1.5 text-sm">
                        Try "{s}"
                      </button>
                    ));
                })()}
              </div>
              <div className="text-xs mt-6 text-secondary/70">Tip: search by song name only, then by artist — separate searches give better matches</div>
            </div>
          )}
          {loading && page === 0 ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <>
              {tab === "all" && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {topResult && (
                      <section className="lg:col-span-1">
                        <h3 className="text-xl font-bold mb-3">Top Result</h3>
                        {topResult.type === "song" ? (
                          <div className="bg-card hover:bg-card-hover rounded-lg p-5 group cursor-pointer" onClick={() => player.playSong(topResult.item)}>
                            <img src={pickImage(topResult.item.image, "high")} alt="" className="w-24 h-24 rounded shadow-xl mb-4 object-cover" />
                            <div className="text-2xl font-bold line-clamp-1">{decodeHtml(topResult.item.name)}</div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-semibold">SONG</span>
                              <span className="text-sm text-secondary line-clamp-1">{decodeHtml(artistsName(topResult.item))}</span>
                            </div>
                            <button className="mt-4 bg-accent text-black rounded-full p-3 opacity-0 group-hover:opacity-100 transition shadow-xl ml-auto block">
                              <Play className="w-5 h-5 fill-black" />
                            </button>
                          </div>
                        ) : (
                          <Link href={`/artist/${topResult.item.id}`} className="bg-card hover:bg-card-hover rounded-lg p-5 block">
                            <img src={pickImage(topResult.item.image, "high")} alt="" className="w-24 h-24 rounded-full shadow-xl mb-4 object-cover" />
                            <div className="text-2xl font-bold line-clamp-1">{decodeHtml(topResult.item.name)}</div>
                            <div className="mt-2"><span className="bg-white/20 px-2 py-0.5 rounded text-xs font-semibold">ARTIST</span></div>
                          </Link>
                        )}
                      </section>
                    )}
                    {songs.length > 0 && (
                      <section className="lg:col-span-2">
                        <h3 className="text-xl font-bold mb-3">Songs</h3>
                        <div>{songs.slice(0, 4).map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} showAlbum={false} />)}</div>
                      </section>
                    )}
                  </div>
                  {albums.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold mb-3">Albums</h2>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {albums.slice(0, 8).map((a) => <AlbumCard key={a.id} album={a} />)}
                      </div>
                    </section>
                  )}
                  {artists.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold mb-3">Artists</h2>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {artists.slice(0, 8).map((a) => <ArtistCard key={a.id} artist={a} />)}
                      </div>
                    </section>
                  )}
                  {playlists.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold mb-3">Playlists</h2>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {playlists.slice(0, 8).map((p) => <PlaylistCard key={p.id} playlist={p} />)}
                      </div>
                    </section>
                  )}
                  {(() => {
                    // Surface songs that came specifically from lyric matching
                    // — usually songs the user typed a half-remembered lyric
                    // for that wouldn't have shown up in the regular results.
                    const lyricFoundSongs = songs.filter((s) => lyricFoundIds.includes(s.id)).slice(0, 6);
                    if (lyricFoundSongs.length === 0) return null;
                    return (
                      <section>
                        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                          <Quote className="w-5 h-5 text-accent" /> Found by lyrics
                          <span className="text-xs font-normal text-secondary">songs whose lyrics matched your search</span>
                        </h2>
                        <div>{lyricFoundSongs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={lyricFoundSongs} />)}</div>
                      </section>
                    );
                  })()}
                </div>
              )}
              {tab === "songs" && (
                <div>
                  {songs.map((s, i) => <SongRow key={`${s.id}-${i}`} song={s} index={i} queue={songs} />)}
                  {hasMore && (
                    <button onClick={loadMore} disabled={loading} className="mx-auto block mt-6 px-6 py-2 bg-card hover:bg-card-hover rounded-full text-sm font-semibold">
                      {loading ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>
              )}
              {tab === "albums" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {albums.map((a) => <AlbumCard key={a.id} album={a} />)}
                </div>
              )}
              {tab === "artists" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
                </div>
              )}
              {tab === "playlists" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
                </div>
              )}
              {tab === "lyrics" && (
                <div className="space-y-2 max-w-3xl">
                  <div className="text-sm text-secondary mb-3 flex items-center gap-2">
                    <Quote className="w-4 h-4" /> Searching lyrics across LRCLIB's catalog…
                  </div>
                  {lyricMatches.length === 0 ? (
                    <div className="text-center py-12 text-secondary">No lyric matches. Try a different snippet.</div>
                  ) : (
                    lyricMatches.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => submit(`${m.trackName} ${m.artistName}`)}
                        className="w-full text-left bg-card hover:bg-card-hover rounded-lg p-4"
                      >
                        <div className="font-semibold">{m.trackName}</div>
                        <div className="text-xs text-secondary mt-0.5">{m.artistName}{m.albumName ? ` — ${m.albumName}` : ""}</div>
                        {m.snippet && <div className="text-sm text-white/70 italic mt-2 line-clamp-2">"{m.snippet}"</div>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-secondary">Loading...</div>}>
      <SearchInner />
    </Suspense>
  );
}
