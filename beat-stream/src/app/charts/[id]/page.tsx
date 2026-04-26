"use client";
import { use, useEffect, useState } from "react";
import { Play, Shuffle, Loader2 } from "lucide-react";
import { CHARTS, getChart } from "@/lib/charts";
import type { Song } from "@/lib/types";
import { usePlayer } from "@/contexts/PlayerContext";
import { SongRow } from "@/components/SongRow";
import { shuffle as shuf } from "@/lib/utils";

export default function ChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const chart = CHARTS.find((c) => c.id === id);
  const player = usePlayer();
  const [songs, setSongs] = useState<Song[] | null>(null);

  useEffect(() => {
    if (!chart) return;
    getChart(id).then(setSongs).catch(() => setSongs([]));
  }, [id, chart]);

  if (!chart) return <div className="p-8 text-center text-secondary">Chart not found</div>;

  return (
    <div className="fade-in">
      <div className={`bg-gradient-to-br ${chart.color} px-4 md:px-12 py-12`}>
        <div className="text-xs uppercase font-bold tracking-widest text-white/80">Chart</div>
        <div className="flex items-baseline gap-4 mt-2">
          <span className="text-5xl">{chart.emoji}</span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{chart.name}</h1>
        </div>
        <p className="text-white/80 mt-3 text-sm">The most-played tracks right now</p>
      </div>
      <div className="px-4 md:px-12 py-6 flex items-center gap-6">
        <button onClick={() => songs?.length && player.playList(songs, 0, chart.name)} className="btn-icon-large">
          <Play className="w-7 h-7 fill-black ml-1" />
        </button>
        <button onClick={() => songs?.length && player.playList(shuf(songs), 0, chart.name)} className="text-white/70 hover:text-white p-2">
          <Shuffle className="w-7 h-7" />
        </button>
      </div>
      <div className="px-4 md:px-12 pb-12">
        {!songs ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : (
          songs.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={songs} />)
        )}
      </div>
    </div>
  );
}
