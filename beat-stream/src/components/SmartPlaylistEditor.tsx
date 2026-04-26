"use client";
import { useState } from "react";
import { X, Plus, Trash2, Sparkles } from "lucide-react";
import { smartPlaylists, type SmartPlaylist, type SmartPlaylistRule } from "@/lib/storage";
import { evaluateSmartPlaylist, RULE_FIELDS, RULE_OPS_TEXT, RULE_OPS_NUMBER, RULE_OPS_BOOL } from "@/lib/smartPlaylistEval";
import { useToast } from "@/contexts/ToastContext";
import { useLibrary } from "@/contexts/LibraryContext";

export function SmartPlaylistEditor({ existing, onClose }: { existing?: SmartPlaylist; onClose: () => void }) {
  const [name, setName] = useState(existing?.name || "");
  const [rules, setRules] = useState<SmartPlaylistRule[]>(existing?.rules || [{ field: "language", op: "is", value: "hindi" }]);
  const [combine, setCombine] = useState<"and" | "or">(existing?.combine || "and");
  const { toast } = useToast();
  const { refreshPlaylists } = useLibrary();

  function updateRule(i: number, patch: Partial<SmartPlaylistRule>) {
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, ...patch } : rule)));
  }
  function addRule() {
    setRules((r) => [...r, { field: "language", op: "is", value: "" }]);
  }
  function removeRule(i: number) {
    setRules((r) => r.filter((_, idx) => idx !== i));
  }

  function preview(): number {
    if (!rules.length) return 0;
    const fake: SmartPlaylist = { id: "preview", name, rules, combine, createdAt: 0 };
    return evaluateSmartPlaylist(fake).length;
  }

  function save() {
    if (!name.trim()) return;
    if (existing) smartPlaylists.update(existing.id, { name, rules, combine });
    else smartPlaylists.create(name.trim(), rules, combine);
    refreshPlaylists();
    toast(existing ? "Smart playlist updated" : "Smart playlist created", "success");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> Smart Playlist</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. 'Hindi 2010s favourites')"
          className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent mb-4"
        />

        <div className="flex items-center gap-3 text-sm mb-3">
          <span className="text-secondary">Match</span>
          <select value={combine} onChange={(e) => setCombine(e.target.value as "and" | "or")} className="bg-bg border border-white/10 rounded px-2 py-1 text-sm">
            <option value="and">all</option>
            <option value="or">any</option>
          </select>
          <span className="text-secondary">of these rules:</span>
        </div>

        <div className="space-y-2 mb-4">
          {rules.map((r, i) => {
            const fieldDef = RULE_FIELDS.find((f) => f.value === r.field)!;
            const ops = fieldDef.type === "text" ? RULE_OPS_TEXT : fieldDef.type === "number" ? RULE_OPS_NUMBER : RULE_OPS_BOOL;
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 bg-white/5 rounded-lg p-2">
                <select value={r.field} onChange={(e) => updateRule(i, { field: e.target.value as any })} className="bg-bg border border-white/10 rounded px-2 py-1 text-sm">
                  {RULE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={r.op} onChange={(e) => updateRule(i, { op: e.target.value as any })} className="bg-bg border border-white/10 rounded px-2 py-1 text-sm">
                  {ops.map((o) => <option key={o} value={o}>{opLabel(o)}</option>)}
                </select>
                {fieldDef.type === "boolean" ? (
                  <select value={String(r.value)} onChange={(e) => updateRule(i, { value: e.target.value === "true" })} className="bg-bg border border-white/10 rounded px-2 py-1 text-sm">
                    <option value="true">yes</option>
                    <option value="false">no</option>
                  </select>
                ) : (
                  <input
                    type={fieldDef.type === "number" ? "number" : "text"}
                    value={String(r.value)}
                    onChange={(e) => updateRule(i, { value: fieldDef.type === "number" ? Number(e.target.value) : e.target.value })}
                    className="bg-bg border border-white/10 rounded px-2 py-1 text-sm flex-1 min-w-[100px] outline-none focus:border-accent"
                  />
                )}
                <button onClick={() => removeRule(i)} className="p-1 text-secondary hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
          <button onClick={addRule} className="w-full text-sm text-accent hover:bg-white/5 rounded-lg py-2 flex items-center justify-center gap-1">
            <Plus className="w-4 h-4" /> Add rule
          </button>
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-secondary">Currently matches:</span>
          <span className="font-bold text-accent">{preview()} songs</span>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-secondary hover:text-white">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="px-4 py-2 bg-accent text-black font-semibold rounded-full disabled:opacity-50">
            {existing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function opLabel(op: SmartPlaylistRule["op"]): string {
  switch (op) {
    case "is": return "is";
    case "isNot": return "is not";
    case "contains": return "contains";
    case "gt": return ">";
    case "gte": return "≥";
    case "lt": return "<";
    case "lte": return "≤";
  }
}
