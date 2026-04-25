"use client";
import { Trash2, X, GripVertical, ListMusic } from "lucide-react";
import Link from "next/link";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { artistsName, decodeHtml, fmtTime, pickImage } from "@/lib/utils";
import { playlists } from "@/lib/storage";
import { useState } from "react";

export default function QueuePage() {
  const { queue, queueIndex, queueSource, removeFromQueue, clearQueue, reorderQueue, playList, currentSong } = usePlayer();
  const { refreshPlaylists } = useLibrary();
  const { toast } = useToast();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function saveAsPlaylist() {
    const name = prompt("Playlist name?", `Queue ${new Date().toLocaleDateString()}`);
    if (!name) return;
    const p = playlists.create(name);
    queue.forEach((s) => playlists.addSong(p.id, s.id));
    refreshPlaylists();
    toast(`Saved as "${name}"`, "success");
  }

  const upcoming = queue.slice(queueIndex + 1);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Queue</h1>

      {currentSong && (
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wider text-secondary mb-2">Now Playing</h2>
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
            <div className="equalizer w-6"><span /><span /><span /></div>
            <img src={pickImage(currentSong.image, "low")} alt="" className="w-10 h-10 rounded object-cover" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-accent line-clamp-1">{decodeHtml(currentSong.name)}</div>
              <div className="text-xs text-secondary line-clamp-1">{decodeHtml(artistsName(currentSong))}</div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm uppercase tracking-wider text-secondary">{queueSource ? `Next from ${queueSource}` : "Next in Queue"}</h2>
          <div className="flex gap-2">
            <button onClick={saveAsPlaylist} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full">Save as Playlist</button>
            <button onClick={() => { if (confirm("Clear queue?")) clearQueue(); }} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-center py-12 text-secondary">
            <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <div>Queue is empty</div>
            <Link href="/search" className="text-accent text-sm hover:underline mt-2 inline-block">Find songs to play</Link>
          </div>
        ) : (
          <div className="space-y-1">
            {upcoming.map((song, relIdx) => {
              const idx = queueIndex + 1 + relIdx;
              return (
                <div
                  key={`${song.id}-${idx}`}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIdx != null && dragIdx !== idx) reorderQueue(dragIdx, idx); setDragIdx(null); }}
                  className="group flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/5"
                  onClick={() => playList(queue, idx, queueSource)}
                >
                  <GripVertical className="w-4 h-4 text-secondary opacity-50" />
                  <img src={pickImage(song.image, "low")} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm line-clamp-1">{decodeHtml(song.name)}</div>
                    <div className="text-xs text-secondary line-clamp-1">{decodeHtml(artistsName(song))}</div>
                  </div>
                  <span className="text-xs text-secondary hidden sm:block">{fmtTime(typeof song.duration === "string" ? parseInt(song.duration, 10) : (song.duration || 0))}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }} className="p-1 text-secondary hover:text-white opacity-0 group-hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
