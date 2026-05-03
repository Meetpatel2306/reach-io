"use client";

import { useEffect, useState } from "react";
import { FileText, Save, Trash2 } from "lucide-react";
import type { Template } from "@/lib/jobAppShared";

interface Props {
  subject: string;
  body: string;
  onLoad: (subject: string, body: string) => void;
}

export function TemplatePicker({ subject, body, onLoad }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [picked, setPicked] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRoleType, setNewRoleType] = useState("");
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

  async function handleSave() {
    setError("");
    if (!newName.trim() || !subject.trim() || !body.trim()) {
      setError("Name, subject, and body are required.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/jobs/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, roleType: newRoleType, subject, body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      setShowSaveModal(false);
      setNewName(""); setNewRoleType("");
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!picked) return;
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/jobs/templates/${picked}`, { method: "DELETE" });
    setPicked("");
    refresh();
  }

  return (
    <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={14} className="text-violet-400" />
        <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Templates</span>
        <span className="text-[10px] text-slate-500">use {"{first_name}"} {"{company}"} {"{role}"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="input-field flex-1 min-w-[200px] text-sm"
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
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          disabled={!subject.trim() || !body.trim()}
          className="px-3 py-2 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          <Save size={12} /> Save current as template
        </button>
        {picked && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 inline-flex items-center gap-1.5"
          >
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md space-y-3">
            <h3 className="text-white font-semibold">Save as template</h3>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Template name</label>
              <input className="input-field text-sm w-full mt-1" placeholder="e.g. Python Backend Developer" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Role type (auto-suggest)</label>
              <input className="input-field text-sm w-full mt-1" placeholder="e.g. python backend developer" value={newRoleType} onChange={(e) => setNewRoleType(e.target.value)} />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowSaveModal(false)} className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
