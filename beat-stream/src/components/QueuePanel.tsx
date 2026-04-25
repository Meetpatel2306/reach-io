"use client";
import { Trash2, X, GripVertical } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { artistsName, pickImage, uid } from "@/lib/utils";
import { playlists } from "@/lib/storage";
import { useState } from "react";

export function QueuePanel() {
  const { queue, queueIndex, removeFromQueue, clearQueue, reorderQueue, playList } = usePlayer();
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

  return (
    <div className="w-full max-w-2xl h-full bg-black/40 rounded-xl p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Queue</h3>
        <div className="flex gap-2">
          <button onClick={saveAsPlaylist} className="text-xs px-3 py-1.5 bg-white/10 rounded-full hover:bg-white/20">
            Save as Playlist
          </button>
          <button onClick={clearQueue} className="text-xs px-3 py-1.5 bg-white/10 rounded-full hover:bg-white/20 flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {queue.map((song, idx) => (
          <div
            key={`${song.id}-${idx}`}
            draggable={idx !== queueIndex}
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx != null && dragIdx !== idx) reorderQueue(dragIdx, idx);
              setDragIdx(null);
            }}
            onClick={() => playList(queue, idx)}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/10 ${idx === queueIndex ? "bg-white/10" : ""}`}
          >
            <GripVertical className="w-4 h-4 text-secondary opacity-50" />
            <img src={pickImage(song.image, "low")} alt="" className="w-10 h-10 rounded object-cover" />
            <div className="flex-1 min-w-0">
              <div className={`text-sm line-clamp-1 ${idx === queueIndex ? "text-accent font-semibold" : ""}`}>{song.name}</div>
              <div className="text-xs text-secondary line-clamp-1">{artistsName(song)}</div>
            </div>
            {idx !== queueIndex && (
              <button
                onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }}
                className="p-1 text-secondary hover:text-white opacity-0 group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {queue.length === 0 && <div className="text-secondary text-sm text-center py-8">Queue is empty</div>}
      </div>
    </div>
  );
}
