"use client";
import { use, useEffect, useState } from "react";
import { Play, Shuffle, Loader2 } from "lucide-react";
import { DECADES, getDecade } from "@/lib/charts";
import type { Song } from "@/lib/types";
import { usePlayer } from "@/contexts/PlayerContext";
import { SongRow } from "@/components/SongRow";
import { shuffle as shuf } from "@/lib/utils";

export default function DecadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const decade = DECADES.find((d) => d.id === id);
  const player = usePlayer();
  const [songs, setSongs] = useState<Song[] | null>(null);

  useEffect(() => {
    if (!decade) return;
    getDecade(id).then(setSongs).catch(() => setSongs([]));
  }, [id, decade]);

  if (!decade) return <div className="p-8 text-center text-secondary">Decade not found</div>;

  return (
    <div className="fade-in">
      <div className={`bg-gradient-to-br ${decade.color} px-4 md:px-12 py-16 flex items-baseline gap-6`}>
        <h1 className="text-7xl md:text-9xl font-black drop-shadow-lg">{decade.label}</h1>
        <div className="text-white/80 text-sm">
          <div className="text-xs uppercase font-bold tracking-widest">Throwback</div>
          <div className="text-base mt-1">Best of the era</div>
        </div>
      </div>
      <div className="px-4 md:px-12 py-6 flex items-center gap-6">
        <button onClick={() => songs?.length && player.playList(songs, 0, `${decade.label} Throwback`)} className="btn-icon-large">
          <Play className="w-7 h-7 fill-black ml-1" />
        </button>
        <button onClick={() => songs?.length && player.playList(shuf(songs), 0, `${decade.label} Throwback`)} className="text-white/70 hover:text-white p-2">
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
