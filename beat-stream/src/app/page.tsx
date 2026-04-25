"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Album, Song, Playlist } from "@/lib/types";
import { greeting, pickImage } from "@/lib/utils";
import { recent, songCache, counts } from "@/lib/storage";
import { useSettings } from "@/contexts/SettingsContext";
import { Section, CardSkeleton } from "@/components/Section";
import { SongCard } from "@/components/SongCard";
import { AlbumCard } from "@/components/AlbumCard";
import { PlaylistCard } from "@/components/PlaylistCard";

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
];

const MOODS = [
  { name: "Romantic", color: "from-pink-500 to-rose-600", q: "romantic love songs" },
  { name: "Sad", color: "from-blue-700 to-indigo-800", q: "sad songs" },
  { name: "Party", color: "from-purple-500 to-pink-600", q: "party songs" },
  { name: "Chill", color: "from-teal-500 to-cyan-600", q: "chill songs" },
  { name: "Workout", color: "from-red-500 to-orange-600", q: "workout songs" },
  { name: "Focus", color: "from-emerald-500 to-green-600", q: "focus instrumental" },
  { name: "Sleep", color: "from-slate-700 to-blue-900", q: "sleep music" },
  { name: "Road Trip", color: "from-amber-500 to-yellow-600", q: "road trip" },
];

export default function HomePage() {
  const { settings } = useSettings();
  const [trending, setTrending] = useState<Song[] | null>(null);
  const [newReleases, setNewReleases] = useState<Album[] | null>(null);
  const [topMixes, setTopMixes] = useState<Playlist[] | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [mostPlayed, setMostPlayed] = useState<Song[]>([]);

  useEffect(() => {
    setRecentlyPlayed(recent.list().slice(0, 10));
    const topIds = counts.top(20);
    const cache = songCache.all();
    setMostPlayed(topIds.map((id) => cache[id]).filter(Boolean) as Song[]);

    api.searchSongs("trending bollywood", 0, 20).then((r) => setTrending(r.results)).catch(() => setTrending([]));
    api.searchAlbums("new releases 2024", 0, 12).then((r) => setNewReleases(r.results)).catch(() => setNewReleases([]));
    api.searchPlaylists("top hits", 0, 8).then((r) => setTopMixes(r.results)).catch(() => setTopMixes([]));
  }, []);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">
          {greeting()}, <span className="text-accent">{settings.displayName}</span>
        </h1>
        <p className="text-secondary mt-1">What would you like to listen to today?</p>
      </div>

      {recentlyPlayed.length > 0 && (
        <Section title="Continue Listening">
          {recentlyPlayed.map((s) => <SongCard key={s.id} song={s} queue={recentlyPlayed} />)}
        </Section>
      )}

      {topMixes && (
        <Section title="Your Top Mixes" href="/search">
          {topMixes === null ? <CardSkeleton /> : topMixes.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
        </Section>
      )}

      <Section title="Trending Now">
        {trending === null ? <CardSkeleton /> : trending.map((s) => <SongCard key={s.id} song={s} queue={trending || []} />)}
      </Section>

      {mostPlayed.length > 0 && (
        <Section title="Most Played">
          {mostPlayed.map((s) => <SongCard key={s.id} song={s} queue={mostPlayed} />)}
        </Section>
      )}

      <Section title="New Releases">
        {newReleases === null ? <CardSkeleton /> : newReleases.map((a) => <AlbumCard key={a.id} album={a} />)}
      </Section>

      <section className="mb-8">
        <h2 className="text-xl md:text-2xl font-bold mb-3 px-1">Browse by Language</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {LANGUAGES.map((l) => (
            <Link
              key={l.name}
              href={`/search?q=${encodeURIComponent(l.name + " hits")}`}
              className={`relative aspect-square rounded-xl bg-gradient-to-br ${l.color} p-4 overflow-hidden hover:scale-[1.03] transition`}
            >
              <span className="font-bold text-lg">{l.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl md:text-2xl font-bold mb-3 px-1">Browse by Mood</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
          {MOODS.map((m) => (
            <Link
              key={m.name}
              href={`/search?q=${encodeURIComponent(m.q)}`}
              className={`relative aspect-[16/9] rounded-xl bg-gradient-to-br ${m.color} p-4 overflow-hidden hover:scale-[1.03] transition flex items-end`}
            >
              <span className="font-bold text-xl">{m.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
