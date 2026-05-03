"use client";

// Send-step combo picker — pick template + resume right before sending.
// Plus: quick slots row (pre-saved template+resume combos) and "save current
// combo as new slot" button. Same Cloud-synced storage as SavedSlotsBar.

import { useEffect, useState } from "react";
import { Star, FileText, FileBox, Plus, Loader2, X, Save } from "lucide-react";
import type { ResumeMeta, Slot, Template } from "@/lib/jobAppShared";

interface ApplyPayload {
  subject: string;
  body: string;
  resumeFile: File;
  resumeFilename: string;
  resumeName: string;
}

interface Props {
  // Current values (so we know what's selected and what to save as a slot)
  currentSubject: string;
  currentBody: string;
  currentResumeFile: File | null;
  currentResumeFilename: string;
  // Apply a chosen template + resume pair into the page state.
  onApply: (payload: ApplyPayload) => void;
  // Apply just a template (subject + body) — used when user picks template-only.
  onApplyTemplate: (subject: string, body: string) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function base64ToFile(base64: string, name: string): File {
  const [meta, data] = base64.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "application/pdf";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function SendStepCombo({
  currentSubject, currentBody, currentResumeFile, currentResumeFilename, onApply, onApplyTemplate,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [resumes, setResumes] = useState<ResumeMeta[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pickedTemplate, setPickedTemplate] = useState("");
  const [pickedResume, setPickedResume] = useState("");
  const [loadingSlotId, setLoadingSlotId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [slotName, setSlotName] = useState("");

  const refresh = async () => {
    try {
      const [t, r, s] = await Promise.all([
        fetch("/api/jobs/templates", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/jobs/resumes", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/jobs/slots", { cache: "no-store" }).then((x) => x.json()),
      ]);
      if (Array.isArray(t.templates)) setTemplates(t.templates);
      if (Array.isArray(r.resumes)) setResumes(r.resumes);
      if (Array.isArray(s.slots)) setSlots(s.slots);
    } catch (e) {
      setError(`Could not load data: ${e}`);
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { refresh(); }, []);

  function applyTemplateById(id: string) {
    setPickedTemplate(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (t) onApplyTemplate(t.subject, t.body);
  }

  async function applyResumeById(id: string) {
    setPickedResume(id);
    if (!id) return;
    const r = resumes.find((x) => x.id === id);
    if (!r) return;
    setBusy(true); setError("");
    try {
      // Saved resumes have only metadata + a server-side filename; if the file is
      // gone (e.g. /tmp wiped on Vercel) the existing send still works because
      // resumeFilename references the server path, but we can't preview locally.
      // Construct a placeholder File for UI display.
      const placeholder = new File([new Blob([], { type: "application/pdf" })], r.filename, { type: "application/pdf" });
      Object.defineProperty(placeholder, "size", { value: r.sizeBytes });
      onApply({
        subject: currentSubject,
        body: currentBody,
        resumeFile: placeholder,
        resumeFilename: r.storedFilename,
        resumeName: r.filename,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadSlot(slot: Slot) {
    setError(""); setLoadingSlotId(slot.id);
    try {
      const file = base64ToFile(slot.resumeBase64, slot.resumeName);
      const fd = new FormData();
      fd.append("resume", file);
      let serverFilename = "";
      try {
        const res = await fetch("/api/upload-resume", { method: "POST", body: fd });
        const data = await res.json();
        serverFilename = data.filename || "";
      } catch {}
      onApply({
        subject: slot.subject,
        body: slot.body,
        resumeFile: file,
        resumeFilename: serverFilename,
        resumeName: slot.resumeName,
      });
    } catch (e) {
      setError(`Load failed: ${e}`);
    } finally {
      setLoadingSlotId("");
    }
  }

  const canSaveSlot = !!(currentSubject.trim() && currentBody.trim() && currentResumeFile);

  async function saveAsSlot() {
    setError("");
    if (!canSaveSlot || !currentResumeFile) {
      setError("Need subject + body + resume before saving.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await fileToBase64(currentResumeFile);
      const r = await fetch("/api/jobs/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: slotName.trim() || `Slot ${slots.length + 1}`,
          subject: currentSubject,
          body: currentBody,
          resumeName: currentResumeFile.name,
          resumeBase64: base64,
          resumeSize: currentResumeFile.size,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      setSlotName("");
      setShowSaveModal(false);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3 sm:p-4 mb-5 space-y-4">
      <div className="flex items-center gap-2">
        <Star size={16} className="text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">What to send</span>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : (
        <>
          {/* Quick Slots — fastest path */}
          {slots.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Quick slots (1 tap = template + resume)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {slots.map((slot, idx) => {
                  const isLoading = loadingSlotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => loadSlot(slot)}
                      disabled={isLoading}
                      className="text-left bg-indigo-500/5 border border-indigo-500/30 rounded-lg p-3 hover:bg-indigo-500/15 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-8 h-8 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold inline-flex items-center justify-center text-sm">
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : `#${idx + 1}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{slot.name}</p>
                          <p className="text-xs text-slate-500 truncate">{slot.resumeName}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual mix-and-match — fallback / advanced */}
          <details className="border border-slate-700/40 rounded-lg" open={slots.length === 0}>
            <summary className="cursor-pointer p-3 text-sm text-slate-300 select-none hover:bg-slate-800/30">
              Or pick template + resume manually
            </summary>
            <div className="p-3 pt-0 space-y-3">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 inline-flex items-center gap-1">
                  <FileText size={12} className="text-violet-400" /> Template
                </label>
                <select
                  className="input-field w-full text-base sm:text-sm py-3 sm:py-2"
                  value={pickedTemplate}
                  onChange={(e) => applyTemplateById(e.target.value)}
                >
                  <option value="">— current ({currentSubject.slice(0, 40) || "no subject"}) —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.roleType ? ` (${t.roleType})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 inline-flex items-center gap-1">
                  <FileBox size={12} className="text-amber-400" /> Resume
                </label>
                <select
                  className="input-field w-full text-base sm:text-sm py-3 sm:py-2"
                  value={pickedResume}
                  onChange={(e) => applyResumeById(e.target.value)}
                  disabled={busy}
                >
                  <option value="">— current ({currentResumeFile?.name || "no resume"}) —</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} · {r.filename}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          {/* Save current combo as a slot */}
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            disabled={!canSaveSlot}
            className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/25 inline-flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.98] transition"
            title={canSaveSlot ? "Save the current template + resume combo as a Quick Slot" : "Need subject + body + resume first"}
          >
            <Plus size={14} /> Save current combo as a Slot
          </button>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg">Save as Slot #{slots.length + 1}</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-sm bg-slate-800/40 border border-slate-700/40 rounded-lg p-3">
              <p className="text-slate-400 text-xs uppercase tracking-wider">Will save</p>
              <p className="text-slate-200 truncate">📧 {currentSubject || "(no subject)"}</p>
              <p className="text-slate-200 truncate">📎 {currentResumeFile?.name || "(no resume)"}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Slot name (optional)</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                placeholder={`Slot ${slots.length + 1}`}
                value={slotName}
                onChange={(e) => setSlotName(e.target.value)}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1">
              <button onClick={() => setShowSaveModal(false)} className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 sm:border-0 rounded-lg sm:rounded">Cancel</button>
              <button onClick={saveAsSlot} disabled={busy || !canSaveSlot} className="w-full sm:w-auto btn-primary py-3 sm:py-2 text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50">
                <Save size={16} /> {busy ? "Saving…" : "Save slot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
