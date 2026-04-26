"use client";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { tags } from "@/lib/storage";

export function TagEditor({ songId, onChange }: { songId: string; onChange?: (tags: string[]) => void }) {
  const [list, setList] = useState<string[]>(() => tags.get(songId));
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const vocab = tags.vocabulary();

  function commit(arr: string[]) {
    setList(arr);
    tags.set(songId, arr);
    onChange?.(arr);
  }

  function addTag(t: string) {
    const clean = t.trim().toLowerCase();
    if (!clean || list.includes(clean)) { setInput(""); setAdding(false); return; }
    commit([...list, clean]);
    setInput(""); setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {list.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-accent/15 text-accent px-2 py-0.5 rounded-full text-xs">
          {t}
          <button onClick={() => commit(list.filter((x) => x !== t))} className="hover:bg-white/10 rounded-full"><X className="w-3 h-3" /></button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addTag(input); if (e.key === "Escape") { setAdding(false); setInput(""); } }}
          onBlur={() => addTag(input)}
          list={`tagvocab-${songId}`}
          placeholder="tag…"
          className="bg-white/10 rounded-full px-2 py-0.5 text-xs outline-none w-20 focus:w-32 transition-all"
        />
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 bg-white/5 hover:bg-white/10 text-secondary px-2 py-0.5 rounded-full text-xs">
          <Plus className="w-3 h-3" /> tag
        </button>
      )}
      <datalist id={`tagvocab-${songId}`}>{vocab.map((v) => <option key={v} value={v} />)}</datalist>
    </div>
  );
}
