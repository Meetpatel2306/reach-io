"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Radio, Zap } from "lucide-react";
import { api } from "@/lib/api";
import type { Album, Song, Playlist } from "@/lib/types";
import { greeting, pickImage, decodeHtml, shuffle as shuf } from "@/lib/utils";
import { recent, songCache, counts } from "@/lib/storage";
import { useSettings } from "@/contexts/SettingsContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { Section, CardSkeleton } from "@/components/Section";
import { SongCard } from "@/components/SongCard";
import { AlbumCard } from "@/components/AlbumCard";
import { PlaylistCard } from "@/components/PlaylistCard";
import { useCached, TTL } from "@/lib/cache";

const LANGUAGES = [
  { name: "Hindi", color: "from-orange-500 via-red-500 to-pink-600", emoji: "🇮🇳" },
  { name: "English", color: "from-blue-500 via-indigo-500 to-purple-600", emoji: "🌍" },
  { name: "Punjabi", color: "from-yellow-500 via-amber-500 to-orange-600", emoji: "🎵" },
  { name: "Tamil", color: "from-emerald-500 via-teal-500 to-cyan-600", emoji: "🎶" },
  { name: "Telugu", color: "from-pink-500 via-rose-500 to-red-600", emoji: "✨" },
  { name: "Bengali", color: "from-indigo-500 via-blue-500 to-cyan-600", emoji: "🎼" },
  { name: "Marathi", color: "from-amber-500 via-orange-500 to-red-600", emoji: "🪕" },
  { name: "Gujarati", color: "from-rose-500 via-pink-500 to-fuchsia-600", emoji: "🎸" },
  { name: "Kannada", color: "from-cyan-500 via-blue-500 to-indigo-600", emoji: "🎤" },
  { name: "Malayalam", color: "from-green-500 via-emerald-500 to-teal-600", emoji: "🎷" },
  { name: "Bhojpuri", color: "from-yellow-600 via-amber-600 to-orange-700", emoji: "🥁" },
  { name: "Haryanvi", color: "from-stone-500 via-zinc-600 to-neutral-700", emoji: "🎺" },
  { name: "Rajasthani", color: "from-fuchsia-500 via-pink-500 to-rose-600", emoji: "🪘" },
  { name: "Assamese", color: "from-teal-500 via-cyan-500 to-blue-600", emoji: "🎻" },
  { name: "Odia", color: "from-violet-500 via-purple-500 to-fuchsia-600", emoji: "🎹" },
];

const MOODS = [
  { name: "Romantic", emoji: "💕", color: "from-pink-500 via-rose-500 to-red-600", q: "romantic love songs" },
  { name: "Sad", emoji: "😢", color: "from-blue-700 via-indigo-700 to-slate-800", q: "sad songs" },
  { name: "Party", emoji: "🎉", color: "from-purple-500 via-fuchsia-500 to-pink-600", q: "party hits" },
  { name: "Chill", emoji: "☕", color: "from-teal-500 via-cyan-500 to-blue-600", q: "chill vibes" },
  { name: "Workout", emoji: "💪", color: "from-red-500 via-orange-500 to-yellow-500", q: "workout pump" },
  { name: "Focus", emoji: "🎯", color: "from-emerald-500 via-green-500 to-lime-500", q: "focus instrumental" },
  { name: "Sleep", emoji: "😴", color: "from-slate-700 via-blue-800 to-indigo-900", q: "sleep music" },
  { name: "Road Trip", emoji: "🚗", color: "from-amber-500 via-yellow-500 to-orange-500", q: "road trip" },
  { name: "Devotional", emoji: "🙏", color: "from-orange-500 via-amber-500 to-yellow-500", q: "devotional bhajan" },
  { name: "Ghazal", emoji: "🥀", color: "from-rose-700 via-red-800 to-pink-900", q: "ghazal" },
  { name: "Sufi", emoji: "🌙", color: "from-emerald-700 via-green-800 to-teal-900", q: "sufi songs" },
  { name: "Indie", emoji: "🎙️", color: "from-stone-500 via-stone-600 to-stone-700", q: "indie pop" },
  { name: "Hip-Hop", emoji: "🎤", color: "from-zinc-700 via-neutral-800 to-stone-900", q: "hip hop" },
  { name: "EDM", emoji: "⚡", color: "from-cyan-500 via-blue-600 to-purple-700", q: "edm bangers" },
  { name: "Classical", emoji: "🎻", color: "from-amber-700 via-yellow-700 to-orange-800", q: "indian classical" },
  { name: "Rock", emoji: "🎸", color: "from-red-700 via-rose-800 to-pink-900", q: "rock" },
  { name: "Jazz", emoji: "🎷", color: "from-purple-700 via-fuchsia-800 to-pink-900", q: "jazz" },
  { name: "Lofi", emoji: "🌧️", color: "from-indigo-500 via-violet-600 to-purple-700", q: "lofi" },
  { name: "90s Bollywood", emoji: "📼", color: "from-yellow-600 via-amber-700 to-orange-800", q: "90s bollywood" },
  { name: "2000s Hits", emoji: "🎶", color: "from-blue-600 via-indigo-700 to-purple-800", q: "2000s hits" },
  { name: "Wedding", emoji: "💍", color: "from-pink-600 via-rose-700 to-red-800", q: "wedding songs" },
  { name: "Qawwali", emoji: "🕌", color: "from-orange-700 via-red-800 to-rose-900", q: "qawwali" },
  { name: "Bhajan", emoji: "🪔", color: "from-amber-600 via-orange-700 to-red-800", q: "bhajan" },
  { name: "K-Pop", emoji: "🇰🇷", color: "from-pink-500 via-fuchsia-500 to-purple-600", q: "k pop" },
  { name: "Anime", emoji: "🌸", color: "from-violet-500 via-purple-500 to-pink-600", q: "anime ost" },
  { name: "Instrumental", emoji: "🎼", color: "from-slate-600 via-gray-700 to-zinc-800", q: "instrumental" },
];

function getDaylist(): { title: string; q: string; emoji: string; from: string; to: string; key: string } {
  const h = new Date().getHours();
  if (h < 12) return { title: "Morning Acoustic", emoji: "☀️", q: "morning chill acoustic", from: "amber-400", to: "orange-600", key: "morning" };
  if (h < 17) return { title: "Afternoon Hits", emoji: "🌤️", q: "upbeat pop hits", from: "blue-400", to: "cyan-600", key: "afternoon" };
  if (h < 21) return { title: "Evening Vibes", emoji: "🌆", q: "evening relaxing hindi", from: "purple-500", to: "pink-700", key: "evening" };
  return { title: "Late Night Lofi", emoji: "🌙", q: "late night lofi chill", from: "indigo-700", to: "slate-900", key: "night" };
}

export default function HomePage() {
  const { settings } = useSettings();
  const player = usePlayer();
  const day = getDaylist();
  const now = new Date();
  const monthYear = `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;

  // Persistent SWR cache: instant render on revisit, background refresh
  const { data: trending } = useCached<Song[]>("home:trending", TTL.trending,
    () => api.searchSongs("trending bollywood", 0, 20).then((r) => r.results));
  const { data: newReleases } = useCached<Album[]>(`home:newReleases:${monthYear}`, TTL.newReleases,
    () => api.searchAlbums(`new releases ${monthYear}`, 0, 12).then((r) => r.results));
  const { data: topMixes } = useCached<Playlist[]>("home:topMixes", TTL.trending,
    () => api.searchPlaylists("top hits", 0, 8).then((r) => r.results));
  const { data: daylist } = useCached<Song[]>(`home:daylist:${day.key}`, TTL.daylist,
    () => api.searchSongs(day.q, 0, 12).then((r) => r.results));
  const { data: discoverRaw } = useCached<Song[]>("home:discover", TTL.daylist,
    () => api.searchSongs("trending", 0, 30).then((r) => r.results));

  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [mostPlayed, setMostPlayed] = useState<Song[]>([]);
  const [topArtists, setTopArtists] = useState<{ id: string; name: string; image: string }[]>([]);
  const [autoMixes, setAutoMixes] = useState<{ artistName: string; songs: Song[] }[]>([]);

  useEffect(() => {
    setRecentlyPlayed(recent.list().slice(0, 20));
    const cache = songCache.all();
    const topIds = counts.top(20);
    setMostPlayed(topIds.map((id) => cache[id]).filter(Boolean) as Song[]);

    const artistTotals: Record<string, { id: string; name: string; image: string; total: number }> = {};
    Object.entries(counts.all()).forEach(([sid, c]) => {
      const s = cache[sid];
      const a = s?.artists?.primary?.[0];
      if (!s || !a) return;
      if (!artistTotals[a.id]) artistTotals[a.id] = { id: a.id, name: a.name, image: pickImage(s.image, "med"), total: 0 };
      artistTotals[a.id].total += c;
    });
    const ranked = Object.values(artistTotals).sort((a, b) => b.total - a.total);
    setTopArtists(ranked.slice(0, 10));

    // Auto mixes — also cached per artist
    const top3 = ranked.slice(0, 3);
    Promise.all(top3.map(async (a) => {
      const songs = await import("@/lib/cache").then(({ cached, TTL }) =>
        cached(`mix:${a.id}`, TTL.daylist, () => api.searchSongs(a.name, 0, 10).then((r) => r.results))
      );
      return { artistName: a.name, songs };
    })).then((res) => setAutoMixes(res.filter((m) => m.songs.length > 0)));
  }, []);

  const playedIds = typeof window !== "undefined" ? new Set(Object.keys(counts.all())) : new Set();
  const discover = (discoverRaw || []).filter((s) => !playedIds.has(s.id)).slice(0, 12);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <div className="hero-bg rounded-3xl mb-8 p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4" /> {greeting()}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Welcome back, <span className="text-accent">{settings.displayName}</span> {settings.avatar}
          </h1>
          <p className="text-secondary mt-2 text-base md:text-lg">What would you like to listen to today?</p>
        </div>
      </div>

      {recentlyPlayed.length > 0 && (
        <section className="mb-10 fade-in">
          <h2 className="section-title mb-4 px-1">Jump back in</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentlyPlayed.slice(0, 6).map((s) => (
              <button key={s.id}
                onClick={() => player.playList(recentlyPlayed, recentlyPlayed.findIndex((x) => x.id === s.id))}
                className="qr-tile h-16 text-left">
                <img src={pickImage(s.image, "low")} alt="" className="w-16 h-16 object-cover" />
                <span className="font-semibold text-sm line-clamp-2 flex-1 pr-12">{decodeHtml(s.name)}</span>
                <div className="qr-play"><svg className="w-4 h-4 fill-black ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {autoMixes.length > 0 && (
        <Section title="Made for you" subtitle="Mixes built from your most-played artists">
          {autoMixes.map((m) => (
            <button key={m.artistName} onClick={() => player.playList(shuf(m.songs), 0, `${m.artistName} Mix`)}
              className="premium-card w-40 sm:w-44 md:w-48 text-left group">
              <div className="card-art-wrap">
                <div className="grid grid-cols-2 gap-px w-full h-full">
                  {m.songs.slice(0, 4).map((s) => <img key={s.id} src={pickImage(s.image, "low")} alt="" className="w-full h-full object-cover" />)}
                </div>
                <div className="play-fab"><svg className="w-5 h-5 fill-black ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
              </div>
              <div className="mt-3 px-1">
                <div className="font-semibold text-sm line-clamp-1">{m.artistName} Mix</div>
                <div className="text-xs text-secondary mt-1">{m.songs.length} songs</div>
              </div>
            </button>
          ))}
        </Section>
      )}

      <section className="mb-10 fade-in">
        <h2 className="section-title mb-4 px-1">Made For You</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => daylist && player.playList(daylist, 0, "Daylist")}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-${day.from} to-${day.to} p-6 text-left aspect-[5/3] flex flex-col justify-between hover:scale-[1.02] transition shadow-2xl`}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="text-5xl float">{day.emoji}</div>
            <div className="relative">
              <div className="text-xs uppercase tracking-widest font-bold opacity-90">daylist</div>
              <div className="font-extrabold text-2xl mt-1">{day.title}</div>
              <div className="text-xs opacity-80 mt-1">Updates throughout the day</div>
            </div>
          </button>
          <button onClick={() => discover.length && player.playList(discover, 0, "Discover Weekly")}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-6 text-left aspect-[5/3] flex flex-col justify-between hover:scale-[1.02] transition shadow-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <Radio className="w-10 h-10 float" />
            <div className="relative">
              <div className="text-xs uppercase tracking-widest font-bold opacity-90">For you</div>
              <div className="font-extrabold text-2xl mt-1">Discover Weekly</div>
              <div className="text-xs opacity-80 mt-1">New songs picked for you</div>
            </div>
          </button>
          <button onClick={() => newReleases && player.playList(newReleases.flatMap((a) => a.songs || []).slice(0, 30), 0, "Release Radar")}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-600 via-rose-600 to-orange-600 p-6 text-left aspect-[5/3] flex flex-col justify-between hover:scale-[1.02] transition shadow-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <Zap className="w-10 h-10 float" />
            <div className="relative">
              <div className="text-xs uppercase tracking-widest font-bold opacity-90">New</div>
              <div className="font-extrabold text-2xl mt-1">Release Radar</div>
              <div className="text-xs opacity-80 mt-1">Latest from artists you follow</div>
            </div>
          </button>
        </div>
      </section>

      <Section title="Trending now" href="/search?q=trending">
        {!trending ? <CardSkeleton /> : trending.map((s) => <SongCard key={s.id} song={s} queue={trending} />)}
      </Section>

      {topArtists.length > 0 && (
        <Section title="Your top artists">
          {topArtists.map((a) => (
            <Link key={a.id} href={`/artist/${a.id}`} className="premium-card w-36 sm:w-40 text-center group">
              <div className="aspect-square rounded-full overflow-hidden shadow-2xl">
                <img src={a.image} alt="" className="card-art rounded-full" loading="lazy" />
              </div>
              <div className="font-semibold text-sm mt-3 line-clamp-1">{a.name}</div>
              <div className="text-xs text-secondary">Artist</div>
            </Link>
          ))}
        </Section>
      )}

      {mostPlayed.length > 0 && (
        <Section title="Most played" subtitle="Your top songs by play count">
          {mostPlayed.map((s) => (
            <div key={s.id} className="relative">
              <SongCard song={s} queue={mostPlayed} />
              <span className="absolute top-5 left-5 bg-black/80 backdrop-blur text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                🔥 {counts.get(s.id)}
              </span>
            </div>
          ))}
        </Section>
      )}

      <Section title={`New in ${monthYear}`}>
        {!newReleases ? <CardSkeleton /> : newReleases.map((a) => (
          <div key={a.id} className="relative">
            <AlbumCard album={a} />
            <span className="absolute top-5 left-5 bg-accent text-black text-[10px] font-extrabold px-2 py-0.5 rounded-full">NEW</span>
          </div>
        ))}
      </Section>

      <Section title="Popular playlists">
        {!topMixes ? <CardSkeleton /> : topMixes.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
      </Section>

      <section className="mb-10 fade-in">
        <h2 className="section-title mb-4 px-1">Browse by language</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {LANGUAGES.map((l) => (
            <Link key={l.name} href={`/search?q=${encodeURIComponent(l.name + " hits")}`}
              className={`relative aspect-square rounded-2xl bg-gradient-to-br ${l.color} p-4 overflow-hidden hover:scale-[1.04] transition shadow-xl flex flex-col justify-between`}>
              <span className="text-3xl float">{l.emoji}</span>
              <span className="font-extrabold text-lg drop-shadow-md">{l.name}</span>
              <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-lg bg-white/15 rotate-12" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12 fade-in">
        <h2 className="section-title mb-4 px-1">Browse by mood & genre</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {MOODS.map((m) => (
            <Link key={m.name} href={`/search?q=${encodeURIComponent(m.q)}`}
              className={`relative aspect-[16/10] rounded-2xl bg-gradient-to-br ${m.color} p-4 overflow-hidden hover:scale-[1.04] transition shadow-xl flex flex-col justify-between`}>
              <span className="text-3xl float">{m.emoji}</span>
              <span className="font-extrabold text-lg drop-shadow-md">{m.name}</span>
              <div className="absolute -bottom-2 -right-2 w-20 h-20 rounded-lg bg-white/10 rotate-12" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
