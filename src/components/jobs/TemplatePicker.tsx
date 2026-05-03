"use client";

import { useEffect, useState } from "react";
import { FileText, Save, Trash2, Pencil, X } from "lucide-react";
import type { Template } from "@/lib/jobAppShared";

interface Props {
  subject: string;
  body: string;
  onLoad: (subject: string, body: string) => void;
}

type Mode = "create" | "edit" | null;

interface Draft {
  id?: string;
  name: string;
  roleType: string;
  subject: string;
  body: string;
}

const EMPTY_DRAFT: Draft = { name: "", roleType: "", subject: "", body: "" };

export function TemplatePicker({ subject, body, onLoad }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [picked, setPicked] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const r = await fetch("/api/jobs/templates", { cache: "no-store" });
      const data = await r.json();
      if (Array.isArray(data.templates)) setTemplates(data.templates);
    } catch {}
  };
  useEffect(() => { refresh(); }, []);

  function handlePick(id: string) {
    setPicked(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (t) onLoad(t.subject, t.body);
  }

  function startCreate() {
    // Pre-fill draft with whatever is currently in the form so "save current as
    // template" still works in one flow.
    setDraft({ ...EMPTY_DRAFT, subject, body });
    setError("");
    setMode("create");
  }

  function startEdit() {
    if (!picked) return;
    const t = templates.find((x) => x.id === picked);
    if (!t) return;
    // Pull latest content from the editor so "Edit" captures current changes too.
    setDraft({ id: t.id, name: t.name, roleType: t.roleType || "", subject, body });
    setError("");
    setMode("edit");
  }

  async function handleSave() {
    setError("");
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      setError("Name, subject, and body are required.");
      return;
    }
    setBusy(true);
    try {
      const url = mode === "edit" && draft.id ? `/api/jobs/templates/${draft.id}` : "/api/jobs/templates";
      const method = mode === "edit" ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          roleType: draft.roleType.trim(),
          subject: draft.subject,
          body: draft.body,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      setMode(null);
      setDraft(EMPTY_DRAFT);
      await refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!picked) return;
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/jobs/templates/${picked}`, { method: "DELETE" });
    setPicked("");
    refresh();
  }

  return (
    <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 sm:p-4 mb-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FileText size={16} className="text-violet-400" />
        <span className="text-sm font-semibold text-violet-300 uppercase tracking-wider">Templates</span>
      </div>

      <select
        className="input-field w-full text-base sm:text-sm py-3 sm:py-2 mb-3"
        value={picked}
        onChange={(e) => handlePick(e.target.value)}
      >
        <option value="">— Load a saved template —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.roleType ? ` (${t.roleType})` : ""}
          </option>
        ))}
      </select>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={startCreate}
          disabled={!subject.trim() || !body.trim()}
          className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/25 disabled:opacity-40 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
        >
          <Save size={16} /> Save current as new
        </button>
        {picked && (
          <>
            <button
              type="button"
              onClick={startEdit}
              className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            >
              <Pencil size={16} /> Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            >
              <Trash2 size={16} /> Delete
            </button>
          </>
        )}
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl p-5 w-full max-w-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg">
                {mode === "edit" ? "Edit template" : "Save as new template"}
              </h3>
              <button onClick={() => setMode(null)} className="text-slate-400 hover:text-slate-200 p-1">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Template name *</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                placeholder="e.g. Python Backend Developer"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Role type (used for matching)</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                placeholder="e.g. python backend developer"
                value={draft.roleType}
                onChange={(e) => setDraft({ ...draft, roleType: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Subject *</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Body *</label>
              <textarea
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2 font-mono"
                rows={12}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1">
              <button
                onClick={() => setMode(null)}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 sm:border-0 rounded-lg sm:rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="w-full sm:w-auto btn-primary py-3 sm:py-2 text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Save size={16} /> {busy ? "Saving…" : (mode === "edit" ? "Update template" : "Save template")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
