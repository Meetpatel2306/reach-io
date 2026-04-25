"use client";
import { use, useEffect, useState } from "react";
import { Play, Shuffle, Trash2, Loader2, ListMusic, Edit2, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Song, UserPlaylist } from "@/lib/types";
import { fmtDuration, shuffle as shuf } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { SongRow } from "@/components/SongRow";
import { playlists, songCache } from "@/lib/storage";
import { useRouter } from "next/navigation";

export default function UserPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { userPlaylists, deletePlaylist, refreshPlaylists } = useLibrary();
  const player = usePlayer();
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const playlist: UserPlaylist | undefined = userPlaylists.find((p) => p.id === id);

  useEffect(() => {
    if (!playlist) { setLoading(false); return; }
    setName(playlist.name);
    setDesc(playlist.description || "");
    setLoading(true);
    const cache = songCache.all();
    const cached = playlist.songIds.map((sid) => cache[sid]).filter(Boolean) as Song[];
    const missing = playlist.songIds.filter((sid) => !cache[sid]);
    if (missing.length === 0) {
      setSongs(cached);
      setLoading(false);
      return;
    }
    Promise.all(missing.map((sid) => api.getSong(sid).then((arr) => Array.isArray(arr) ? arr[0] : arr).catch(() => null)))
      .then((fetched) => {
        const got = fetched.filter(Boolean) as Song[];
        songCache.putMany(got);
        const map: Record<string, Song> = {};
        [...cached, ...got].forEach((s) => { if (s?.id) map[s.id] = s; });
        const ordered = playlist.songIds.map((sid) => map[sid]).filter(Boolean) as Song[];
        setSongs(ordered);
        setLoading(false);
      });
  }, [id, playlist]);

  if (!playlist) return <div className="p-8 text-center text-secondary">Playlist not found</div>;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  const list = songs || [];
  const totalDuration = list.reduce((sum, s) => sum + (typeof s.duration === "string" ? parseInt(s.duration, 10) : (s.duration || 0)), 0);

  function saveEdit() {
    playlists.update(playlist!.id, { name, description: desc });
    refreshPlaylists();
    setEditing(false);
    toast("Playlist updated", "success");
  }

  function handleDelete() {
    if (!confirm(`Delete "${playlist!.name}"?`)) return;
    deletePlaylist(playlist!.id);
    router.push("/library");
  }

  return (
    <div className="fade-in">
      <div className="relative bg-gradient-to-b from-purple-900/40 via-purple-900/10 to-bg">
        <div className="px-4 md:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-6 items-end">
          <div className="w-48 h-48 md:w-56 md:h-56 rounded-md shadow-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
            <ListMusic className="w-24 h-24 text-white/80" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase font-semibold text-secondary">Playlist</div>
            {editing ? (
              <div className="space-y-2 mt-2">
                <input value={name} onChange={(e) => setName(e.target.value)} className="text-3xl font-bold bg-bg border border-white/10 rounded px-3 py-1 w-full outline-none focus:border-accent" />
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="text-sm bg-bg border border-white/10 rounded px-3 py-1 w-full outline-none focus:border-accent" />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="px-3 py-1 bg-accent text-black rounded font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> Save</button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1 bg-white/10 rounded flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl md:text-5xl font-bold mt-2 flex items-center gap-2">
                  {playlist.name}
                  <button onClick={() => setEditing(true)} className="p-2 text-secondary hover:text-white">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </h1>
                {playlist.description && <p className="text-secondary mt-2 text-sm">{playlist.description}</p>}
                <p className="text-secondary mt-3 text-sm">{list.length} songs • {fmtDuration(totalDuration)}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 py-4 flex items-center gap-4">
        <button onClick={() => list.length && player.playList(list, 0)} className="bg-accent text-black rounded-full p-4 hover:scale-105 transition shadow-lg">
          <Play className="w-6 h-6 fill-black ml-0.5" />
        </button>
        <button onClick={() => list.length && player.playList(shuf(list), 0)} className="text-secondary hover:text-white p-2">
          <Shuffle className="w-6 h-6" />
        </button>
        <button onClick={handleDelete} className="ml-auto text-red-400 hover:text-red-300 p-2 flex items-center gap-1 text-sm">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>

      <div className="px-4 md:px-6 lg:px-8 pb-8">
        {list.length === 0 ? (
          <div className="text-center py-16 text-secondary">
            <ListMusic className="w-16 h-16 mx-auto mb-3 opacity-30" />
            <p className="mb-1">This playlist is empty</p>
            <p className="text-sm">Find songs and tap the menu → Add to Playlist</p>
          </div>
        ) : (
          list.map((s, i) => <SongRow key={`${s.id}-${i}`} song={s} index={i} queue={list} />)
        )}
      </div>
    </div>
  );
}
