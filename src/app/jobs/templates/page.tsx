"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { fetchTemplates, removeTemplate, saveTemplate, updateTemplate } from "../_lib/client";
import type { Template } from "@/lib/jobAppShared";

const EMPTY: Partial<Template> = { name: "", roleType: "", subject: "", body: "" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try { setTemplates(await fetchTemplates()); } catch (e) { setError(String(e)); }
  };
  useEffect(() => { refresh(); }, []);

  async function handleSave() {
    if (!editing?.name || !editing.subject || !editing.body) {
      setError("Name, subject, and body are required.");
      return;
    }
    setBusy(true); setError("");
    try {
      if (editing.id) await updateTemplate(editing.id, editing);
      else await saveTemplate(editing);
      setEditing(null);
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    await removeTemplate(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Templates</h2>
          <p className="text-sm text-slate-400">
            Use placeholders <code className="bg-slate-800 px-1 rounded text-xs">{"{first_name}"}</code>{" "}
            <code className="bg-slate-800 px-1 rounded text-xs">{"{company}"}</code>{" "}
            <code className="bg-slate-800 px-1 rounded text-xs">{"{role}"}</code>.
            They&apos;re auto-filled per recipient.
          </p>
        </div>
        <button onClick={() => setEditing(EMPTY)} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium">
          <Plus className="w-4 h-4" /> New template
        </button>
      </div>

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      {/* List */}
      <div className="grid md:grid-cols-2 gap-3">
        {templates.length === 0 && <p className="text-slate-500 text-sm">Loading…</p>}
        {templates.map((t) => (
          <div key={t.id} className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{t.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">role-type: {t.roleType || "—"}</p>
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">{t.subject}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setEditing(t)} className="text-xs text-indigo-300 hover:text-indigo-200 px-2 py-1 rounded">Edit</button>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-medium">{editing.id ? "Edit template" : "New template"}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Name *">
                <input className="input" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Role type (used for auto-suggest)">
                <input className="input" placeholder="e.g. python backend developer" value={editing.roleType || ""} onChange={(e) => setEditing({ ...editing, roleType: e.target.value })} />
              </Field>
              <Field label="Subject *">
                <input className="input" value={editing.subject || ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
              </Field>
              <Field label="Body *">
                <textarea className="input min-h-[300px] font-mono text-sm" value={editing.body || ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
              </Field>
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                <button onClick={handleSave} disabled={busy} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                  <Save className="w-4 h-4" /> {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: rgb(15 23 42 / 0.6);
          border: 1px solid rgb(30 41 59);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          color: rgb(241 245 249);
          font-size: 0.875rem;
        }
        :global(.input:focus) { outline: 1px solid rgb(99 102 241); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
