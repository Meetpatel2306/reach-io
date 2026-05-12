"use client";

// Dedicated Templates page — manage all your saved email templates in one
// uncluttered view. Replaces the cramped inline TemplatePicker for editing
// (the picker still exists on the main page, but only for "load this" use).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, Pencil, Trash2, Save, X, Search, Copy, Check, Upload, Paperclip } from "lucide-react";
import type { Template } from "@/lib/jobAppShared";

interface Draft {
  id?: string;
  name: string;
  roleType: string;
  subject: string;
  body: string;
  resumePath: string;
  // Baked resume — fields are present only when one is attached.
  resumeName?: string;
  resumeBase64?: string;
  resumeSize?: number;
}

const EMPTY_DRAFT: Draft = { name: "", roleType: "", subject: "", body: "", resumePath: "" };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const refresh = async () => {
    try {
      const r = await fetch("/api/jobs/templates", { cache: "no-store" });
      const data = await r.json();
      if (Array.isArray(data.templates)) setTemplates(data.templates);
    } catch (e) { setError(String(e)); }
    finally { setLoaded(true); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = templates.filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return [t.name, t.roleType, t.subject, t.body].some((f) => (f || "").toLowerCase().includes(s));
  });

  async function handleSave() {
    if (!draft) return;
    setError("");
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      setError("Name, subject, and body are all required.");
      return;
    }
    setBusy(true);
    try {
      const url = draft.id ? `/api/jobs/templates/${draft.id}` : "/api/jobs/templates";
      const method = draft.id ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          roleType: draft.roleType.trim(),
          subject: draft.subject,
          body: draft.body,
          resumePath: draft.resumePath.trim() || undefined,
          resumeName: draft.resumeName,
          resumeBase64: draft.resumeBase64,
          resumeSize: draft.resumeSize,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      setDraft(null);
      await refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/jobs/templates/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function handleDuplicate(t: Template) {
    setBusy(true);
    try {
      await fetch("/api/jobs/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${t.name} (copy)`,
          roleType: t.roleType,
          subject: t.subject,
          body: t.body,
          resumePath: t.resumePath,
        }),
      });
      await refresh();
    } finally { setBusy(false); }
  }

  async function handleCopyBody(t: Template) {
    try {
      await navigator.clipboard.writeText(`${t.subject}\n\n${t.body}`);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(""), 1500);
    } catch {}
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText size={22} className="text-violet-400" /> Templates
            </h1>
            <p className="text-slate-500 text-xs">
              {templates.length} template{templates.length === 1 ? "" : "s"} · synced to your account
            </p>
          </div>
        </div>
        <button
          onClick={() => { setError(""); setDraft({ ...EMPTY_DRAFT }); }}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium active:scale-[0.98] transition"
        >
          <Plus size={16} /> New template
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-10 pr-3 py-3 text-base sm:text-sm text-slate-100 focus:outline-1 focus:outline-violet-500"
          placeholder="Search templates by name, role, subject, body..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {!loaded ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-700 rounded-xl text-slate-500">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">{search ? "No templates match your search." : "No templates yet. Click \"New template\" to create one."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((t) => (
            <div key={t.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 hover:border-violet-500/40 transition group flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-semibold text-white text-base truncate flex-1 min-w-0">{t.name}</h3>
                {t.roleType && (
                  <span className="text-[10px] uppercase tracking-wider text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5 shrink-0">
                    {t.roleType}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 mb-1 line-clamp-1">{t.subject}</p>
              <p className="text-xs text-slate-500 line-clamp-3 flex-1 mb-2">{t.body.slice(0, 200)}{t.body.length > 200 ? "…" : ""}</p>
              {t.resumeName && t.resumeBase64 ? (
                <p className="text-[10px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1 mb-3 truncate" title={`${t.resumeName} · ${((t.resumeSize || 0) / 1024).toFixed(0)} KB`}>
                  <Paperclip size={10} className="inline mr-1" />
                  Resume attached: <span className="font-mono">{t.resumeName}</span>
                  <span className="text-emerald-300/60"> · {((t.resumeSize || 0) / 1024).toFixed(0)} KB</span>
                </p>
              ) : t.resumePath ? (
                <p className="text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1 mb-3 truncate" title={t.resumePath}>
                  📎 Resume folder: <span className="font-mono">{t.resumePath}</span>
                </p>
              ) : null}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    setError("");
                    setDraft({
                      id: t.id,
                      name: t.name,
                      roleType: t.roleType,
                      subject: t.subject,
                      body: t.body,
                      resumePath: t.resumePath || "",
                      resumeName: t.resumeName,
                      resumeBase64: t.resumeBase64,
                      resumeSize: t.resumeSize,
                    });
                  }}
                  className="px-3 py-1.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-200 text-xs hover:bg-violet-500/25 inline-flex items-center gap-1 active:scale-[0.98] transition"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDuplicate(t)}
                  className="px-3 py-1.5 rounded bg-slate-700/40 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700/70 inline-flex items-center gap-1 active:scale-[0.98] transition"
                >
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  onClick={() => handleCopyBody(t)}
                  className="px-3 py-1.5 rounded bg-slate-700/40 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700/70 inline-flex items-center gap-1 active:scale-[0.98] transition"
                >
                  {copiedId === t.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy text</>}
                </button>
                <button
                  onClick={() => handleDelete(t.id, t.name)}
                  className="ml-auto px-2.5 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 inline-flex items-center gap-1 active:scale-[0.98] transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl p-5 w-full max-w-3xl space-y-4 max-h-[95vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg">{draft.id ? "Edit template" : "New template"}</h3>
              <button onClick={() => setDraft(null)} className="text-slate-400 hover:text-slate-200 p-1">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Name *</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                placeholder="e.g. Python Backend Developer"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Role type</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                placeholder="e.g. python backend developer (used as a tag/filter)"
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
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                rows={14}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Plain text. Recipient placeholders: <code className="text-violet-300">{"{first_name}"}</code>, <code className="text-violet-300">{"{company}"}</code>, <code className="text-violet-300">{"{role}"}</code> — auto-filled per send if used.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Resume folder / path (optional reminder)</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2 font-mono"
                placeholder="e.g. D:\Users\Meet\Desktop\automation\resume"
                value={draft.resumePath}
                onChange={(e) => setDraft({ ...draft, resumePath: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Just a note for you — server can&apos;t access local paths.
              </p>
            </div>

            <ResumeUploadField draft={draft} setDraft={setDraft} />


            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1">
              <button onClick={() => setDraft(null)} className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 sm:border-0 rounded-lg sm:rounded">Cancel</button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Save size={16} /> {busy ? "Saving…" : draft.id ? "Save changes" : "Create template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Resume upload field (used inside the editor modal) ----
function ResumeUploadField({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(""); setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      setDraft({
        ...draft,
        resumeName: file.name,
        resumeBase64: b64,
        resumeSize: file.size,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function clearResume() {
    setDraft({ ...draft, resumeName: undefined, resumeBase64: undefined, resumeSize: undefined });
  }

  return (
    <div>
      <label className="text-xs text-slate-400 uppercase tracking-wider">
        Attach a resume (optional — saved with this template)
      </label>

      {draft.resumeName && draft.resumeBase64 ? (
        <div className="mt-1 flex items-start gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
          <Paperclip size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-200 truncate">{draft.resumeName}</p>
            <p className="text-xs text-emerald-300/70">
              {((draft.resumeSize || 0) / 1024).toFixed(0)} KB · attached to this template
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs hover:bg-emerald-500/25 inline-flex items-center gap-1"
          >
            <Upload size={12} /> Replace
          </button>
          <button
            type="button"
            onClick={clearResume}
            className="text-red-400/80 hover:text-red-400 p-1"
            aria-label="Remove resume"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-lg border border-dashed border-slate-600 hover:border-emerald-500/50 bg-slate-900/40 hover:bg-emerald-500/5 text-slate-300 text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
          >
            <Upload size={14} />
            {busy ? "Reading file..." : "Upload resume (PDF/DOC)"}
          </button>
          <p className="text-xs text-slate-500 mt-1">
            Optional — when set, the resume auto-attaches every time this template is loaded into the compose step.
          </p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
