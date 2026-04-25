"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Song } from "@/lib/types";
import { api } from "@/lib/api";

export function LyricsPanel({ song }: { song: Song }) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(18);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLyrics(null);
    api.getLyrics(song.id).then((l) => {
      if (!cancelled) {
        setLyrics(l);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [song.id]);

  return (
    <div className="w-full max-w-2xl h-full bg-black/40 rounded-xl p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Lyrics</h3>
        <div className="flex items-center gap-2 text-xs text-secondary">
          <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="px-2 py-1 hover:bg-white/10 rounded">A-</button>
          <button onClick={() => setFontSize(Math.min(28, fontSize + 2))} className="px-2 py-1 hover:bg-white/10 rounded">A+</button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-secondary">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : lyrics ? (
        <div
          className="whitespace-pre-line leading-relaxed text-white/90"
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: lyrics }}
        />
      ) : (
        <div className="text-center text-secondary py-12">
          Lyrics not available for this song
        </div>
      )}
    </div>
  );
}
