"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, TrendingUp, Music, BarChart3, Calendar, Globe } from "lucide-react";
import { history, songCache, counts, listenTime } from "@/lib/storage";
import { artistsName, decodeHtml, fmtTime, pickImage } from "@/lib/utils";
import type { Song } from "@/lib/types";
import { usePlayer } from "@/contexts/PlayerContext";

function bucketDate(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const dayDiff = Math.floor((+now - +d) / (1000 * 60 * 60 * 24));
  if (dayDiff < 7) return "This Week";
  if (dayDiff < 30) return "This Month";
  return "Older";
}

export default function HistoryPage() {
  const player = usePlayer();
  const [entries, setEntries] = useState<{ songId: string; timestamp: number; song: Song }[]>([]);
  const [topSongs, setTopSongs] = useState<{ song: Song; count: number }[]>([]);
  const [topArtists, setTopArtists] = useState<{ name: string; id: string; image: string; total: number }[]>([]);
  const [byLanguage, setByLanguage] = useState<{ name: string; pct: number }[]>([]);
  const [byHour, setByHour] = useState<number[]>([]);
  const [totalSec, setTotalSec] = useState(0);

  useEffect(() => {
    const cache = songCache.all();
    const h = history.list();
    const enriched = h.map((e) => ({ ...e, song: cache[e.songId] })).filter((e) => !!e.song);
    setEntries(enriched);

    const cmap = counts.all();
    const top = Object.entries(cmap)
      .map(([id, c]) => ({ song: cache[id], count: c }))
      .filter((x) => !!x.song)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setTopSongs(top);

    const artistTotals: Record<string, { name: string; id: string; image: string; total: number }> = {};
    Object.entries(cmap).forEach(([id, c]) => {
      const s = cache[id];
      if (!s) return;
      const a = s.artists?.primary?.[0];
      if (!a) return;
      if (!artistTotals[a.id]) artistTotals[a.id] = { name: a.name, id: a.id, image: pickImage(s.image, "low"), total: 0 };
      artistTotals[a.id].total += c;
    });
    setTopArtists(Object.values(artistTotals).sort((a, b) => b.total - a.total).slice(0, 10));

    const langCount: Record<string, number> = {};
    let totalLang = 0;
    Object.entries(cmap).forEach(([id, c]) => {
      const s = cache[id];
      if (!s?.language) return;
      langCount[s.language] = (langCount[s.language] || 0) + c;
      totalLang += c;
    });
    setByLanguage(
      Object.entries(langCount).map(([name, n]) => ({ name, pct: totalLang ? (n / totalLang) * 100 : 0 }))
        .sort((a, b) => b.pct - a.pct).slice(0, 8)
    );

    const hourly = new Array(24).fill(0);
    h.forEach((e) => { hourly[new Date(e.timestamp).getHours()]++; });
    setByHour(hourly);

    setTotalSec(listenTime.get());
  }, []);

  const grouped = useMemo(() => {
    const out: Record<string, typeof entries> = {};
    entries.forEach((e) => {
      const k = bucketDate(e.timestamp);
      if (!out[k]) out[k] = [];
      out[k].push(e);
    });
    return out;
  }, [entries]);

  const totalPlays = Object.values(counts.all()).reduce((s, n) => s + n, 0);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const maxHour = Math.max(...byHour, 1);
  const colors = ["#1ed760", "#3b82f6", "#8b5cf6", "#ef4444", "#f97316", "#ec4899", "#06b6d4", "#eab308"];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Listening Stats</h1>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat icon={Music} label="Total plays" value={totalPlays.toString()} />
        <Stat icon={Clock} label="Listening time" value={`${hours}h ${mins}m`} />
        <Stat icon={TrendingUp} label="Top artist" value={topArtists[0]?.name || "—"} />
        <Stat icon={Calendar} label="Last 7 days" value={(entries.filter((e) => Date.now() - e.timestamp < 7 * 86400_000).length).toString()} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-accent uppercase tracking-wide mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4" />Top 10 Songs</h3>
          <div className="space-y-2">
            {topSongs.map(({ song, count }, i) => (
              <div key={song.id} className="flex items-center gap-2 text-sm">
                <span className="text-secondary w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-1">{decodeHtml(song.name)}</div>
                  <div className="text-xs text-secondary line-clamp-1">{decodeHtml(artistsName(song))}</div>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <div className="flex-1 h-1.5 bg-white/10 rounded">
                    <div className="h-full bg-accent rounded" style={{ width: `${(count / (topSongs[0]?.count || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs text-secondary w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
            {!topSongs.length && <div className="text-secondary text-sm text-center py-4">No plays yet</div>}
          </div>
        </div>

        <div className="bg-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-accent uppercase tracking-wide mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Top 10 Artists</h3>
          <div className="space-y-2">
            {topArtists.map((a, i) => (
              <Link key={a.id} href={`/artist/${a.id}`} className="flex items-center gap-3 text-sm hover:bg-white/5 rounded p-1">
                <span className="text-secondary w-5">{i + 1}</span>
                <img src={a.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                <div className="flex-1">{a.name}</div>
                <span className="text-xs text-secondary">{a.total} plays</span>
              </Link>
            ))}
            {!topArtists.length && <div className="text-secondary text-sm text-center py-4">No plays yet</div>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-accent uppercase tracking-wide mb-4 flex items-center gap-2"><Globe className="w-4 h-4" />By Language</h3>
          {byLanguage.length === 0 ? (
            <div className="text-secondary text-sm text-center py-4">No language data</div>
          ) : (
            <>
              <div className="h-3 rounded-full overflow-hidden flex">
                {byLanguage.map((l, i) => (
                  <div key={l.name} style={{ width: `${l.pct}%`, background: colors[i % colors.length] }} />
                ))}
              </div>
              <ul className="mt-3 space-y-1">
                {byLanguage.map((l, i) => (
                  <li key={l.name} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded" style={{ background: colors[i % colors.length] }} />
                    <span className="capitalize flex-1">{l.name}</span>
                    <span className="text-secondary text-xs">{l.pct.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="bg-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-accent uppercase tracking-wide mb-4">Listening by Hour</h3>
          <div className="flex items-end gap-1 h-32">
            {byHour.map((v, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-accent/30 rounded-t" style={{ height: `${(v / maxHour) * 100}%`, minHeight: 2 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-secondary mt-1"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3">Recently Played</h2>
        {Object.entries(grouped).map(([bucket, items]) => (
          <div key={bucket} className="mb-6">
            <h3 className="text-sm uppercase tracking-wider text-secondary mb-2">{bucket}</h3>
            <div className="space-y-1">
              {items.slice(0, 50).map((e, i) => (
                <button
                  key={`${e.songId}-${e.timestamp}-${i}`}
                  onClick={() => player.playSong(e.song)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left"
                >
                  <img src={pickImage(e.song.image, "low")} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm line-clamp-1">{decodeHtml(e.song.name)}</div>
                    <div className="text-xs text-secondary line-clamp-1">{decodeHtml(artistsName(e.song))}</div>
                  </div>
                  <span className="text-xs text-secondary">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!entries.length && <div className="text-secondary text-center py-12">Your play history will appear here</div>}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl p-4">
      <Icon className="w-4 h-4 text-accent mb-2" />
      <div className="text-xs text-secondary">{label}</div>
      <div className="text-lg font-bold line-clamp-1">{value}</div>
    </div>
  );
}
