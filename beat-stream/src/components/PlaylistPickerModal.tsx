"use client";
import { useState } from "react";
import { X, Plus, ListMusic } from "lucide-react";
import type { Song } from "@/lib/types";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";

export function PlaylistPickerModal({ song, onClose }: { song: Song; onClose: () => void }) {
  const { userPlaylists, addToPlaylist, createPlaylist } = useLibrary();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  function pick(pid: string, pname: string) {
    addToPlaylist(pid, song.id);
    toast(`Added to ${pname}`, "success");
    onClose();
  }

  function handleCreate() {
    if (!name.trim()) return;
    const p = createPlaylist(name.trim());
    addToPlaylist(p.id, song.id);
    toast(`Created and added to ${p.name}`, "success");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Add to Playlist</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
        </div>

        {creating ? (
          <div className="space-y-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Playlist name"
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="px-4 py-2 text-secondary hover:text-white">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-accent text-black font-semibold rounded-full">Create</button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/10 rounded-lg text-left text-accent border border-dashed border-accent/40 mb-2"
            >
              <Plus className="w-5 h-5" /> New Playlist
            </button>
            <div className="max-h-80 overflow-y-auto">
              {userPlaylists.length === 0 ? (
                <div className="text-center text-secondary py-8 text-sm">No playlists yet — create one above</div>
              ) : userPlaylists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id, p.name)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg text-left"
                >
                  <ListMusic className="w-5 h-5 text-secondary" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-secondary">{p.songIds.length} songs</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
