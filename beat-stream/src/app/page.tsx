"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Album, Song, Playlist, Artist } from "@/lib/types";
import { greeting, pickImage, decodeHtml, shuffle as shuf, artistsName } from "@/lib/utils";
import { recent, songCache, counts } from "@/lib/storage";
import { useSettings } from "@/contexts/SettingsContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { Section, CardSkeleton } from "@/components/Section";
import { SongCard } from "@/components/SongCard";
import { AlbumCard } from "@/components/AlbumCard";
import { PlaylistCard } from "@/components/PlaylistCard";
import { ArtistCard } from "@/components/ArtistCard";

const LANGUAGES = [
  { name: "Hindi", color: "from-orange-500 to-red-600" },
  { name: "English", color: "from-blue-500 to-purple-600" },
  { name: "Punjabi", color: "from-yellow-500 to-orange-600" },
  { name: "Tamil", color: "from-emerald-500 to-teal-600" },
  { name: "Telugu", color: "from-pink-500 to-red-600" },
  { name: "Bengali", color: "from-indigo-500 to-blue-600" },
  { name: "Marathi", color: "from-amber-500 to-orange-600" },
  { name: "Gujarati", color: "from-rose-500 to-pink-600" },
  { name: "Kannada", color: "from-cyan-500 to-blue-600" },
  { name: "Malayalam", color: "from-green-500 to-emerald-600" },
  { name: "Bhojpuri", color: "from-yellow-600 to-amber-700" },
  { name: "Haryanvi", color: "from-stone-600 to-zinc-700" },
  { name: "Rajasthani", color: "from-fuchsia-500 to-pink-600" },
  { name: "Assamese", color: "from-teal-500 to-cyan-600" },
  { name: "Odia", color: "from-violet-500 to-purple-600" },
];

const MOODS = [
  { name: "Romantic 💕", color: "from-pink-500 to-rose-600", q: "romantic love songs" },
  { name: "Sad 😢", color: "from-blue-700 to-indigo-800", q: "sad songs" },
  { name: "Party 🎉", color: "from-purple-500 to-pink-600", q: "party hits" },
  { name: "Chill ☕", color: "from-teal-500 to-cyan-600", q: "chill vibes" },
  { name: "Workout 💪", color: "from-red-500 to-orange-600", q: "workout pump" },
  { name: "Focus 🎯", color: "from-emerald-500 to-green-600", q: "focus instrumental" },
  { name: "Sleep 😴", color: "from-slate-700 to-blue-900", q: "sleep music" },
  { name: "Road Trip 🚗", color: "from-amber-500 to-yellow-600", q: "road trip" },
  { name: "Devotional 🙏", color: "from-orange-500 to-amber-600", q: "devotional bhajan" },
  { name: "Ghazal", color: "from-rose-700 to-red-900", q: "ghazal" },
  { name: "Sufi", color: "from-emerald-700 to-green-900", q: "sufi songs" },
  { name: "Indie", color: "from-stone-500 to-stone-700", q: "indie pop" },
  { name: "Hip-Hop 🎤", color: "from-zinc-700 to-neutral-900", q: "hip hop" },
  { name: "EDM ⚡", color: "from-cyan-500 to-blue-700", q: "edm bangers" },
  { name: "Classical 🎻", color: "from-amber-700 to-yellow-900", q: "indian classical" },
  { name: "Rock 🎸", color: "from-red-700 to-rose-900", q: "rock" },
  { name: "Jazz 🎷", color: "from-purple-700 to-fuchsia-900", q: "jazz" },
  { name: "Lofi 🌧️", color: "from-indigo-600 to-violet-700", q: "lofi" },
  { name: "90s Bollywood", color: "from-yellow-600 to-amber-800", q: "90s bollywood" },
  { name: "2000s Hits", color: "from-blue-600 to-indigo-700", q: "2000s hits" },
  { name: "Wedding 💍", color: "from-pink-600 to-rose-800", q: "wedding songs" },
  { name: "Qawwali", color: "from-orange-700 to-red-800", q: "qawwali" },
  { name: "Bhajan", color: "from-amber-600 to-orange-700", q: "bhajan" },
  { name: "K-Pop 🇰🇷", color: "from-pink-500 to-fuchsia-600", q: "k pop" },
  { name: "Anime", color: "from-violet-500 to-purple-600", q: "anime ost" },
  { name: "Instrumental", color: "from-slate-600 to-gray-700", q: "instrumental" },
];

function getDaylist(): { title: string; q: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { title: "Morning Acoustic", emoji: "☀️", q: "morning chill acoustic" };
  if (h < 17) return { title: "Afternoon Hits", emoji: "🌤️", q: "upbeat pop hits" };
  if (h < 21) return { title: "Evening Vibes", emoji: "🌆", q: "evening relaxing hindi" };
  return { title: "Late Night Lofi", emoji: "🌙", q: "late night lofi chill" };
}

export default function HomePage() {
  const { settings } = useSettings();
  const player = usePlayer();
  const [trending, setTrending] = useState<Song[] | null>(null);
  const [newReleases, setNewReleases] = useState<Album[] | null>(null);
  const [topMixes, setTopMixes] = useState<Playlist[] | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [mostPlayed, setMostPlayed] = useState<Song[]>([]);
  const [topArtists, setTopArtists] = useState<{ id: string; name: string; image: string }[]>([]);
  const [daylist, setDaylist] = useState<Song[] | null>(null);
  const [discover, setDiscover] = useState<Song[] | null>(null);
  const [autoMixes, setAutoMixes] = useState<{ artistName: string; songs: Song[] }[]>([]);

  const day = getDaylist();
  const now = new Date();
  const monthYear = `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;

  useEffect(() => {
    setRecentlyPlayed(recent.list().slice(0, 20));
    const cache = songCache.all();
    const topIds = counts.top(20);
    const top = topIds.map((id) => cache[id]).filter(Boolean) as Song[];
    setMostPlayed(top);

    // Top artists derived from play counts
    const artistTotals: Record<string, { id: string; name: string; image: string; total: number }> = {};
    Object.entries(counts.all()).forEach(([sid, c]) => {
      const s = cache[sid];
      const a = s?.artists?.primary?.[0];
      if (!s || !a) return;
      if (!artistTotals[a.id]) artistTotals[a.id] = { id: a.id, name: a.name, image: pickImage(s.image, "med"), total: 0 };
      artistTotals[a.id].total += c;
    });
    setTopArtists(Object.values(artistTotals).sort((a, b) => b.total - a.total).slice(0, 10));

    // Auto mixes: top 3 artists × their songs
    const topArtistIds = Object.values(artistTotals).sort((a, b) => b.total - a.total).slice(0, 3);
    Promise.all(topArtistIds.map(async (a) => {
      try {
        const r = await api.searchSongs(a.name, 0, 10);
        return { artistName: a.name, songs: r.results };
      } catch { return { artistName: a.name, songs: [] }; }
    })).then((res) => setAutoMixes(res.filter((m) => m.songs.length > 0)));

    api.searchSongs("trending bollywood", 0, 20).then((r) => setTrending(r.results)).catch(() => setTrending([]));
    api.searchAlbums(`new releases ${monthYear}`, 0, 12).then((r) => setNewReleases(r.results)).catch(() => setNewReleases([]));
    api.searchPlaylists("top hits", 0, 8).then((r) => setTopMixes(r.results)).catch(() => setTopMixes([]));
    api.searchSongs(day.q, 0, 12).then((r) => setDaylist(r.results)).catch(() => setDaylist([]));
    api.searchSongs("trending", 0, 30).then((r) => {
      const playedIds = new Set(Object.keys(counts.all()));
      setDiscover(r.results.filter((s) => !playedIds.has(s.id)).slice(0, 12));
    }).catch(() => setDiscover([]));
  }, [day.q, monthYear]);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">
          {greeting()}, <span className="text-accent">{settings.displayName}</span>
        </h1>
        <p className="text-secondary mt-1">What would you like to listen to today?</p>
      </div>

      {recentlyPlayed.length > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recentlyPlayed.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => player.playList(recentlyPlayed, recentlyPlayed.findIndex((x) => x.id === s.id))}
                className="bg-white/5 hover:bg-white/15 rounded-md flex items-center gap-3 overflow-hidden text-left transition group"
              >
                <img src={pickImage(s.image, "low")} alt="" className="w-14 h-14 object-cover" />
                <span className="font-semibold text-sm line-clamp-2 flex-1 pr-3">{decodeHtml(s.name)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {autoMixes.length > 0 && (
        <Section title="Your Mixes">
          {autoMixes.map((m) => (
            <button
              key={m.artistName}
              onClick={() => player.playList(shuf(m.songs), 0, `${m.artistName} Mix`)}
              className="w-40 sm:w-44 md:w-48 bg-card rounded-lg p-3 card-hover text-left"
            >
              <div className="grid grid-cols-2 gap-0.5 aspect-square rounded-md overflow-hidden">
                {m.songs.slice(0, 4).map((s) => <img key={s.id} src={pickImage(s.image, "low")} alt="" className="w-full h-full object-cover" />)}
              </div>
              <div className="font-semibold text-sm mt-3 line-clamp-1">{m.artistName} Mix</div>
              <div className="text-xs text-secondary mt-1 line-clamp-1">{m.songs.length} songs</div>
            </button>
          ))}
        </Section>
      )}

      <Section title="Made For You">
        <button
          onClick={() => daylist && player.playList(daylist, 0, "Daylist")}
          className="w-64 bg-gradient-to-br from-purple-600 to-blue-700 rounded-lg p-4 text-left hover:scale-[1.02] transition flex flex-col justify-between aspect-[4/5]"
        >
          <div className="text-3xl">{day.emoji}</div>
          <div>
            <div className="font-bold text-lg">daylist</div>
            <div className="text-sm">{day.title}</div>
            <div className="text-xs text-white/80 mt-1">Updates throughout the day</div>
          </div>
        </button>
        <button
          onClick={() => discover && player.playList(discover, 0, "Discover Weekly")}
          className="w-64 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-lg p-4 text-left hover:scale-[1.02] transition flex flex-col justify-between aspect-[4/5]"
        >
          <div className="text-3xl">🔍</div>
          <div>
            <div className="font-bold text-lg">Discover Weekly</div>
            <div className="text-sm">New songs picked for you</div>
          </div>
        </button>
        <button
          onClick={() => newReleases && player.playList(newReleases.flatMap((a) => a.songs || []).slice(0, 30), 0, "Release Radar")}
          className="w-64 bg-gradient-to-br from-pink-600 to-orange-600 rounded-lg p-4 text-left hover:scale-[1.02] transition flex flex-col justify-between aspect-[4/5]"
        >
          <div className="text-3xl">📡</div>
          <div>
            <div className="font-bold text-lg">Release Radar</div>
            <div className="text-sm">Latest from artists you follow</div>
          </div>
        </button>
      </Section>

      <Section title="Trending Now">
        {trending === null ? <CardSkeleton /> : trending.map((s) => <SongCard key={s.id} song={s} queue={trending} />)}
      </Section>

      {topArtists.length > 0 && (
        <Section title="Your Top Artists">
          {topArtists.map((a) => (
            <Link key={a.id} href={`/artist/${a.id}`} className="w-36 sm:w-40 bg-card rounded-lg p-3 card-hover text-center">
              <img src={a.image} alt="" className="w-full aspect-square rounded-full object-cover" />
              <div className="font-semibold text-sm mt-3 line-clamp-1">{a.name}</div>
              <div className="text-xs text-secondary">Artist</div>
            </Link>
          ))}
        </Section>
      )}

      {mostPlayed.length > 0 && (
        <Section title="Most Played">
          {mostPlayed.map((s) => (
            <div key={s.id} className="relative">
              <SongCard song={s} queue={mostPlayed} />
              <span className="absolute top-5 left-5 bg-black/70 text-xs px-2 py-0.5 rounded-full">🔥 {counts.get(s.id)}</span>
            </div>
          ))}
        </Section>
      )}

      <Section title={`New in ${monthYear}`}>
        {newReleases === null ? <CardSkeleton /> : newReleases.map((a) => (
          <div key={a.id} className="relative">
            <AlbumCard album={a} />
            <span className="absolute top-5 left-5 bg-accent text-black text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
          </div>
        ))}
      </Section>

      <Section title="Popular Playlists">
        {topMixes === null ? <CardSkeleton /> : topMixes.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
      </Section>

      <section className="mb-8">
        <h2 className="text-xl md:text-2xl font-bold mb-3 px-1">Browse by Language</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {LANGUAGES.map((l) => (
            <Link key={l.name} href={`/search?q=${encodeURIComponent(l.name + " hits")}`}
              className={`relative aspect-square rounded-xl bg-gradient-to-br ${l.color} p-4 overflow-hidden hover:scale-[1.03] transition`}>
              <span className="font-bold text-lg">{l.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl md:text-2xl font-bold mb-3 px-1">Browse by Mood & Genre</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {MOODS.map((m) => (
            <Link key={m.name} href={`/search?q=${encodeURIComponent(m.q)}`}
              className={`relative aspect-[16/9] rounded-xl bg-gradient-to-br ${m.color} p-4 overflow-hidden hover:scale-[1.03] transition flex items-end`}>
              <span className="font-bold text-lg">{m.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
