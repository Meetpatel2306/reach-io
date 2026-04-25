"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { counts, listenTime, songCache } from "@/lib/storage";
import { artistsName, decodeHtml, pickImage } from "@/lib/utils";
import type { Song } from "@/lib/types";
import { useToast } from "@/contexts/ToastContext";

interface Wrap {
  totalPlays: number;
  hours: number;
  mins: number;
  topSong?: { song: Song; count: number };
  topArtist?: { name: string; id: string; image: string; total: number };
  topLang?: { name: string; pct: number };
  topSongs: { song: Song; count: number }[];
  topArtists: { name: string; id: string; image: string; total: number }[];
}

const GRADIENTS = [
  "from-pink-600 via-purple-600 to-indigo-700",
  "from-emerald-600 via-teal-600 to-cyan-700",
  "from-orange-500 via-red-600 to-pink-700",
  "from-blue-600 via-indigo-700 to-purple-800",
  "from-yellow-500 via-orange-500 to-red-600",
  "from-fuchsia-600 via-purple-600 to-pink-700",
  "from-cyan-500 via-blue-500 to-indigo-600",
  "from-rose-500 via-pink-600 to-purple-700",
  "from-lime-500 via-emerald-600 to-teal-700",
  "from-violet-600 via-fuchsia-600 to-rose-700",
];

export default function WrappedPage() {
  const [wrap, setWrap] = useState<Wrap | null>(null);
  const [card, setCard] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const cache = songCache.all();
    const cmap = counts.all();
    const totalPlays = Object.values(cmap).reduce((s, n) => s + n, 0);
    const sec = listenTime.get();
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);

    const songsRanked = Object.entries(cmap)
      .map(([id, c]) => ({ song: cache[id], count: c }))
      .filter((x) => !!x.song)
      .sort((a, b) => b.count - a.count);

    const artistTotals: Record<string, { name: string; id: string; image: string; total: number }> = {};
    Object.entries(cmap).forEach(([id, c]) => {
      const s = cache[id];
      if (!s) return;
      const a = s.artists?.primary?.[0];
      if (!a) return;
      if (!artistTotals[a.id]) artistTotals[a.id] = { name: a.name, id: a.id, image: pickImage(s.image, "med"), total: 0 };
      artistTotals[a.id].total += c;
    });
    const artistsRanked = Object.values(artistTotals).sort((a, b) => b.total - a.total);

    const langCount: Record<string, number> = {};
    let totalLang = 0;
    Object.entries(cmap).forEach(([id, c]) => {
      const s = cache[id];
      if (!s?.language) return;
      langCount[s.language] = (langCount[s.language] || 0) + c;
      totalLang += c;
    });
    const langs = Object.entries(langCount)
      .map(([name, n]) => ({ name, pct: totalLang ? (n / totalLang) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);

    setWrap({
      totalPlays, hours, mins,
      topSong: songsRanked[0],
      topArtist: artistsRanked[0],
      topLang: langs[0],
      topSongs: songsRanked.slice(0, 5),
      topArtists: artistsRanked.slice(0, 5),
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCard((c) => Math.min(c + 1, 9)), 6000);
    return () => clearInterval(id);
  }, [card]);

  if (!wrap) return <div className="p-8 text-center text-secondary">Calculating your wrapped...</div>;

  const cards: { title: string; body: React.ReactNode }[] = [
    { title: "Your BeatStream Wrapped", body: <p className="text-2xl">A year of your music in one story.</p> },
    { title: `You played ${wrap.totalPlays.toLocaleString()} songs`, body: <p className="text-9xl font-black">{wrap.totalPlays}</p> },
    { title: `That's ${wrap.hours}h ${wrap.mins}m of music`, body: <p className="text-2xl">⏱️ Time well spent.</p> },
    { title: "Your #1 song was…", body: wrap.topSong ? <div className="flex flex-col items-center gap-4"><img src={pickImage(wrap.topSong.song.image, "high")} className="w-56 h-56 rounded-xl object-cover shadow-2xl" alt="" /><div className="text-2xl font-bold">{decodeHtml(wrap.topSong.song.name)}</div></div> : <p>Not enough data</p> },
    { title: "You played it…", body: <p className="text-9xl font-black">{wrap.topSong?.count ?? 0}<span className="text-3xl font-normal block mt-2">times</span></p> },
    { title: "Your top artist", body: wrap.topArtist ? <div className="flex flex-col items-center gap-4"><img src={wrap.topArtist.image} className="w-56 h-56 rounded-full object-cover shadow-2xl" alt="" /><div className="text-3xl font-bold">{wrap.topArtist.name}</div><div className="text-lg">{wrap.topArtist.total} plays</div></div> : <p>Not enough data</p> },
    { title: "Your top 5 songs", body: <ol className="text-xl space-y-2 text-left max-w-md mx-auto">{wrap.topSongs.map((s, i) => <li key={s.song.id}>{i + 1}. {decodeHtml(s.song.name)}</li>)}</ol> },
    { title: "Your top 5 artists", body: <div className="flex flex-wrap gap-3 justify-center">{wrap.topArtists.map((a) => <div key={a.id} className="text-center"><img src={a.image} className="w-20 h-20 rounded-full object-cover mx-auto mb-1" alt="" /><div className="text-sm">{a.name}</div></div>)}</div> },
    { title: `You love ${wrap.topLang?.name || "all"} music the most`, body: wrap.topLang ? <p className="text-7xl font-black capitalize">{wrap.topLang.name}<span className="text-2xl font-normal block mt-3">{wrap.topLang.pct.toFixed(0)}% of your listening</span></p> : <p>No language data</p> },
    { title: "Share your Wrapped!", body: <button onClick={() => { const text = `My BeatStream Wrapped:\n${wrap.totalPlays} songs played • ${wrap.hours}h ${wrap.mins}m • Top: ${wrap.topSong?.song.name || "—"}`; if (navigator.share) navigator.share({ title: "BeatStream Wrapped", text }); else { navigator.clipboard.writeText(text); toast("Copied to clipboard!", "success"); } }} className="bg-white text-black px-6 py-3 rounded-full font-semibold flex items-center gap-2 mx-auto"><Share2 className="w-5 h-5" /> Share</button> },
  ];

  const c = cards[card];
  return (
    <div className={`fixed inset-0 z-30 bg-gradient-to-br ${GRADIENTS[card % GRADIENTS.length]} flex flex-col`} style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex gap-1 px-4 py-2">
        {cards.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/30 rounded">
            <div className="h-full bg-white rounded" style={{ width: i < card ? "100%" : i === card ? "60%" : "0%", transition: "width 6s linear" }} />
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={() => setCard(Math.max(0, card - 1))} />
      <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={() => setCard(Math.min(cards.length - 1, card + 1))} />
      <div className="flex-1 flex flex-col items-center justify-center text-white text-center px-6 fade-in" key={card}>
        <h2 className="text-3xl md:text-4xl font-bold mb-8">{c.title}</h2>
        <div>{c.body}</div>
      </div>
      <div className="flex justify-between px-4 pb-4 z-20">
        <button onClick={() => setCard(Math.max(0, card - 1))} className="p-3 bg-white/20 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
        <button onClick={() => setCard(Math.min(cards.length - 1, card + 1))} className="p-3 bg-white/20 rounded-full"><ChevronRight className="w-5 h-5" /></button>
      </div>
    </div>
  );
}
