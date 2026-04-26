"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Radio, Zap, Flame, Clock as ClockIcon, Trophy } from "lucide-react";
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
import { CHARTS, DECADES } from "@/lib/charts";
import { getClusters, getOnRepeat, getRepeatRewind, getTimeCapsule, getBecauseYouPlayed, getStreak } from "@/lib/recommend";
import { AchievementsCard } from "@/components/AchievementsCard";
import { GoalRing } from "@/components/GoalRing";

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
];

const MOODS = [
  { name: "Romantic", emoji: "💕", color: "from-pink-500 via-rose-500 to-red-600", q: "romantic love songs" },
  { name: "Sad", emoji: "😢", color: "from-blue-700 via-indigo-700 to-slate-800", q: "sad songs" },
  { name: "Party", emoji: "🎉", color: "from-purple-500 via-fuchsia-500 to-pink-600", q: "party hits" },
  { name: "Chill", emoji: "☕", color: "from-teal-500 via-cyan-500 to-blue-600", q: "chill vibes" },
  { name: "Workout", emoji: "💪", color: "from-red-500 via-orange-500 to-yellow-500", q: "workout pump" },
  { name: "Focus", emoji: "🎯", color: "from-emerald-500 via-green-500 to-lime-500", q: "focus instrumental" },
  { name: "Sleep", emoji: "😴", color: "from-slate-700 via-blue-800 to-indigo-900", q: "sleep music" },
  { name: "Lofi", emoji: "🌧️", color: "from-indigo-500 via-violet-600 to-purple-700", q: "lofi" },
];

function getDaylist(): { title: string; q: string; emoji: string; from: string; to: string; key: string } {
  const h = new Date().getHours();
  if (h < 12) return { title: "Morning Acoustic", emoji: "☀️", q: "morning chill acoustic", from: "amber-400", to: "orange-600", key: "morning" };
  if (h < 17) return { title: "Afternoon Hits", emoji: "🌤️", q: "upbeat pop hits", from: "blue-400", to: "cyan-600", key: "afternoon" };
  if (h < 21) return { title: "Evening Vibes", emoji: "🌆", q: "evening relaxing hindi", from: "purple-500", to: "pink-700", key: "evening" };
  return { title: "Late Night Lofi", emoji: "🌙", q: "late night lofi chill", from: "indigo-700", to: "slate-900", key: "night" };
}

const MIX_GRADIENTS = [
  "from-pink-500 via-rose-600 to-purple-700",
  "from-emerald-500 via-teal-600 to-cyan-700",
  "from-amber-500 via-orange-600 to-red-700",
  "from-blue-500 via-indigo-600 to-purple-700",
  "from-fuchsia-500 via-pink-600 to-rose-700",
  "from-cyan-500 via-blue-600 to-indigo-700",
];

export default function HomePage() {
  const { settings } = useSettings();
  const player = usePlayer();
  const day = getDaylist();
  const now = new Date();
  const monthYear = `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;

  // Cached server data (instant on revisits)
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

  // User-derived recommendations (computed from localStorage)
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [mostPlayed, setMostPlayed] = useState<Song[]>([]);
  const [topArtists, setTopArtists] = useState<{ id: string; name: string; image: string }[]>([]);
  const [clusters, setClusters] = useState<ReturnType<typeof getClusters>>([]);
  const [onRepeat, setOnRepeat] = useState<Song[]>([]);
  const [repeatRewind, setRepeatRewind] = useState<Song[]>([]);
  const [timeCapsule, setTimeCapsule] = useState<Song[]>([]);
  const [becauseSong, setBecauseSong] = useState<Song | null>(null);
  const [streak, setStreak] = useState(0);
  // Computed-from-localStorage values that must be 0 on SSR + first-render
  // (otherwise hydration mismatches the post-hydration value).
  const [recapTotal, setRecapTotal] = useState(0);
  const [recapArtists, setRecapArtists] = useState(0);

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
    setTopArtists(Object.values(artistTotals).sort((a, b) => b.total - a.total).slice(0, 10));


  const playedIds = typeof window !== "undefined" ? new Set(Object.keys(counts.all())) : new Set();
  const discover = (discoverRaw || []).filter((s) => !playedIds.has(s.id)).slice(0, 12);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      {/* Hero */}
      <div className="hero-bg rounded-3xl mb-8 p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4" /> {greeting()}
            {streak > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                🔥 {streak}-day streak
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Welcome back, <span className="text-accent">{settings.displayName}</span> {settings.avatar}
          </h1>
          <p className="text-secondary mt-2 text-base md:text-lg">What would you like to listen to today?</p>
        </div>
      </div>

      {/* Daily goal ring + last week recap */}
      <section className="mb-10 fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GoalRing />
          <div className="bg-card rounded-2xl p-4 flex flex-col justify-center">
            <div className="text-xs uppercase tracking-widest text-accent font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> This week
            </div>
            <div className="font-bold text-lg mt-0.5">
              {(() => {
                const cmap = counts.all();
                const cache = songCache.all();
                const total = Object.values(cmap).reduce((a, b) => a + b, 0);
                const artistSet = new Set<string>();
                Object.keys(cmap).forEach((id) => { const a = cache[id]?.artists?.primary?.[0]?.id; if (a) artistSet.add(a); });
                return `${total} plays • ${artistSet.size} artists`;
              })()}
            </div>
            <div className="text-xs text-secondary">Track everything in History →</div>
          </div>
        </div>
      </section>

      {/* Quick Resume */}
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

      {/* Daily Mix 1-6 — taste clusters */}
      {clusters.length > 0 && (
        <Section title="Your Daily Mix" subtitle="Built from your taste — a different vibe per mix">
          {clusters.map((c, i) => (
            <button key={c.key}
              onClick={() => player.playList(shuf(c.songs), 0, `${c.artistName} Mix · #${i + 1}`)}
              className="premium-card w-44 sm:w-48 text-left group">
              <div className={`relative w-full aspect-square rounded-md overflow-hidden bg-gradient-to-br ${MIX_GRADIENTS[i % MIX_GRADIENTS.length]} p-3 flex flex-col justify-between shadow-lg`}>
                <div className="text-xs uppercase tracking-widest font-bold opacity-80">Daily Mix {i + 1}</div>
                <div>
                  <div className="font-extrabold text-xl line-clamp-2 drop-shadow">{c.artistName}</div>
                  <div className="text-xs opacity-80 capitalize mt-1">{c.language || "your taste"}</div>
                </div>
                <div className="play-fab"><svg className="w-5 h-5 fill-black ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
              </div>
              <div className="mt-3 px-1">
                <div className="font-semibold text-sm line-clamp-1">Mix #{i + 1}</div>
                <div className="text-xs text-secondary mt-1">Your top {c.artistName} & similar</div>
              </div>
            </button>
          ))}
        </Section>
      )}

      {/* On Repeat */}
      {onRepeat.length > 0 && (
        <Section title="On Repeat" subtitle="Songs you've replayed lately">
          {onRepeat.map((s) => <SongCard key={s.id} song={s} queue={onRepeat} />)}
        </Section>
      )}

      {/* Repeat Rewind */}
      {repeatRewind.length > 0 && (
        <Section title="Repeat Rewind" subtitle="Old favourites you might have forgotten">
          {repeatRewind.map((s) => <SongCard key={s.id} song={s} queue={repeatRewind} />)}
        </Section>
      )}

      {/* Time Capsule */}
      {timeCapsule.length > 0 && (
        <Section title="Time Capsule" subtitle="What you were playing this time last year">
          {timeCapsule.map((s) => <SongCard key={s.id} song={s} queue={timeCapsule} />)}
        </Section>
      )}

      {/* Made For You hero cards */}
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

      {/* Because you played X */}
      {becauseSong && (
        <section className="mb-10 fade-in bg-card rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-4">
            <img src={pickImage(becauseSong.image, "med")} alt="" className="w-20 h-20 rounded-md object-cover shadow-xl" />
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-widest text-accent font-bold">Because you played</div>
              <div className="font-bold text-lg line-clamp-1">{decodeHtml(becauseSong.name)}</div>
              <div className="text-sm text-secondary">More songs like this for you</div>
            </div>
            <button
              onClick={() => player.playSong(becauseSong)}
              className="btn-icon-large flex-shrink-0"
              aria-label="Play radio"
            >
              <svg className="w-7 h-7 fill-black ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </button>
          </div>
        </section>
      )}

      <Section title="Trending now" href="/search?q=trending">
        {!trending ? <CardSkeleton /> : trending.map((s) => <SongCard key={s.id} song={s} queue={trending} />)}
      </Section>

      {/* Top Charts strip */}
      <section className="mb-10 fade-in">
        <div className="flex items-end justify-between mb-4 px-1">
          <div>
            <h2 className="section-title">Top Charts</h2>
            <p className="text-sm text-secondary mt-1">What's #1 around the world</p>
          </div>
          <Link href="/charts" className="text-xs font-bold text-secondary hover:text-white uppercase tracking-wider">Show all</Link>
        </div>
        <div className="h-scroll no-scrollbar">
          {CHARTS.slice(0, 8).map((c) => (
            <Link key={c.id} href={`/charts/${c.id}`}
              className={`relative w-44 sm:w-48 aspect-video rounded-xl bg-gradient-to-br ${c.color} p-4 overflow-hidden hover:scale-[1.04] transition shadow-xl flex flex-col justify-between flex-shrink-0`}>
              <div className="text-3xl float">{c.emoji}</div>
              <div className="font-extrabold text-base drop-shadow">{c.name}</div>
              <Trophy className="absolute -top-2 -right-2 w-12 h-12 text-white/10" />
            </Link>
          ))}
        </div>
      </section>

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
                <Flame className="w-3 h-3 text-orange-400" /> {counts.get(s.id)}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Decade browsing */}
      <section className="mb-10 fade-in">
        <div className="flex items-end justify-between mb-4 px-1">
          <div>
            <h2 className="section-title">Throwbacks</h2>
            <p className="text-sm text-secondary mt-1">Browse music by decade</p>
          </div>
          <Link href="/decades" className="text-xs font-bold text-secondary hover:text-white uppercase tracking-wider">Show all</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {DECADES.map((d) => (
            <Link key={d.id} href={`/decades/${d.id}`}
              className={`aspect-square rounded-2xl bg-gradient-to-br ${d.color} p-3 overflow-hidden hover:scale-[1.04] transition shadow-xl flex items-center justify-center`}>
              <span className="text-3xl md:text-4xl font-black drop-shadow">{d.label}</span>
            </Link>
          ))}
        </div>
      </section>

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

      <AchievementsCard />

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
