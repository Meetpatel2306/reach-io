"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, X, Mic, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Album, Artist, Playlist, Song } from "@/lib/types";
import { searches } from "@/lib/storage";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/contexts/ToastContext";
import { SongRow } from "@/components/SongRow";
import { AlbumCard } from "@/components/AlbumCard";
import { ArtistCard } from "@/components/ArtistCard";
import { PlaylistCard } from "@/components/PlaylistCard";

type Tab = "all" | "songs" | "albums" | "artists" | "playlists";

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
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);

  useEffect(() => { setRecent(searches.list()); }, []);

  useEffect(() => {
    if (!debounced.trim()) {
      setSongs([]); setAlbums([]); setArtists([]); setPlaylists([]); setHasMore(false);
      return;
    }
    setLoading(true);
    setPage(0);
    Promise.all([
      api.searchSongs(debounced, 0, 20).then((r) => r.results).catch(() => []),
      api.searchAlbums(debounced, 0, 12).then((r) => r.results).catch(() => []),
      api.searchArtists(debounced, 0, 12).then((r) => r.results).catch(() => []),
      api.searchPlaylists(debounced, 0, 12).then((r) => r.results).catch(() => []),
    ]).then(([s, a, ar, p]) => {
      setSongs(s); setAlbums(a); setArtists(ar); setPlaylists(p);
      setHasMore(s.length >= 20);
      setLoading(false);
    });
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
    const r = await api.searchSongs(debounced, next, 20).catch(() => null);
    if (r) {
      setSongs((s) => [...s, ...r.results]);
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
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      submit(text);
    };
    r.onerror = () => toast("Voice search error", "error");
    r.start();
    toast("Listening...", "info");
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "songs", label: "Songs" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
    { key: "playlists", label: "Playlists" },
  ];

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
            placeholder="Songs, albums, artists, podcasts"
            className="w-full bg-card rounded-full pl-12 pr-24 py-3 text-base outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            {query && (
              <button onClick={() => setQuery("")} className="p-2 text-secondary hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
            <button onClick={startVoice} className="p-2 text-secondary hover:text-accent">
              <Mic className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {!query && recent.length > 0 && (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Recent searches</h2>
            <button onClick={() => { searches.clear(); setRecent([]); }} className="text-xs text-secondary hover:text-white">
              Clear all
            </button>
          </div>
          <div className="space-y-1">
            {recent.map((q) => (
              <button
                key={q}
                onClick={() => submit(q)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-card rounded-lg text-left"
              >
                <SearchIcon className="w-4 h-4 text-secondary" />
                <span className="flex-1">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {query && (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${tab === t.key ? "bg-white text-black" : "bg-card text-secondary hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && page === 0 ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <>
              {tab === "all" && (
                <div className="space-y-8">
                  {songs.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold mb-3">Songs</h2>
                      <div>{songs.slice(0, 5).map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} />)}</div>
                    </section>
                  )}
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
                </div>
              )}
              {tab === "songs" && (
                <div>
                  {songs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} />)}
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
