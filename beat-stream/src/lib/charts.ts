// Top Charts data — built from Saavn searches because the public mirror doesn't
// expose a chart endpoint directly. Each chart is a curated query that reliably
// returns the actual top tracks for that region/genre.

import { api } from "./api";
import { cached, TTL } from "./cache";
import type { Song } from "./types";

export const CHARTS = [
  { id: "global-top-50",    name: "Global Top 50",   q: "global top 50 hits",                 color: "from-blue-500 to-purple-600",   emoji: "🌍" },
  { id: "india-top-50",     name: "India Top 50",    q: "top hits india 2024",                color: "from-orange-500 to-red-600",    emoji: "🇮🇳" },
  { id: "hindi-top-50",     name: "Hindi Top 50",    q: "top hindi songs",                    color: "from-pink-500 to-rose-600",     emoji: "🎬" },
  { id: "punjabi-top-50",   name: "Punjabi Top 50",  q: "top punjabi songs",                  color: "from-yellow-500 to-amber-600",  emoji: "🎵" },
  { id: "tamil-top-50",     name: "Tamil Top 50",    q: "top tamil hits",                     color: "from-emerald-500 to-teal-600",  emoji: "🎶" },
  { id: "telugu-top-50",    name: "Telugu Top 50",   q: "top telugu songs",                   color: "from-fuchsia-500 to-pink-600",  emoji: "✨" },
  { id: "english-top-50",   name: "English Top 50",  q: "top english pop hits",               color: "from-indigo-500 to-blue-700",   emoji: "🇺🇸" },
  { id: "trending-india",   name: "Trending India",  q: "trending india",                     color: "from-amber-500 to-orange-600",  emoji: "🔥" },
  { id: "viral-50",         name: "Viral 50",        q: "viral songs trending",               color: "from-purple-500 to-fuchsia-600", emoji: "📈" },
  { id: "new-music-friday", name: "New Music Friday", q: "new music friday this week",        color: "from-cyan-500 to-blue-600",     emoji: "📅" },
  { id: "k-pop-top",        name: "K-Pop Top",       q: "kpop top hits",                      color: "from-pink-500 to-fuchsia-600",  emoji: "🇰🇷" },
  { id: "edm-top",          name: "EDM Top",         q: "top edm hits",                       color: "from-cyan-500 to-blue-700",     emoji: "⚡" },
];

export const DECADES = [
  { id: "60s",   label: "60s", q: "1960s hits classic",        color: "from-amber-700 to-orange-800" },
  { id: "70s",   label: "70s", q: "1970s hits",                color: "from-orange-600 to-red-700" },
  { id: "80s",   label: "80s", q: "1980s hits",                color: "from-pink-600 to-purple-700" },
  { id: "90s",   label: "90s", q: "90s bollywood and english", color: "from-purple-600 to-indigo-700" },
  { id: "2000s", label: "2000s", q: "2000s hits",              color: "from-blue-600 to-cyan-700" },
  { id: "2010s", label: "2010s", q: "2010s hits",              color: "from-emerald-600 to-teal-700" },
  { id: "2020s", label: "2020s", q: "2020s hits",              color: "from-fuchsia-600 to-pink-700" },
];

export async function getChart(chartId: string, limit = 50): Promise<Song[]> {
  const c = CHARTS.find((x) => x.id === chartId);
  if (!c) return [];
  const data = await cached(`chart:${chartId}`, TTL.trending, () => api.searchSongs(c.q, 0, limit));
  return data.results;
}

export async function getDecade(decadeId: string, limit = 30): Promise<Song[]> {
  const d = DECADES.find((x) => x.id === decadeId);
  if (!d) return [];
  const data = await cached(`decade:${decadeId}`, TTL.trending, () => api.searchSongs(d.q, 0, limit));
  return data.results;
}
