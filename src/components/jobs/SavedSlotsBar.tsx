"use client";

// Saved Slots — bundle a (template + resume) pair into a numbered slot.
// Click slot N → both template and resume load in one tap → ready to send.

import { useEffect, useState } from "react";
import { Star, Plus, Trash2, FileBox, Mail, Loader2, X, Save } from "lucide-react";

export interface Slot {
  id: string;
  name: string;
  subject: string;
  body: string;
  resumeName: string;        // original file name (e.g. Meet_Patel_Resume.pdf)
  resumeFilename: string;    // last-known server-side filename (re-uploaded on load)
  resumeBase64: string;      // dataURL for client-side re-upload
  resumeSize: number;
  savedAt: string;
}

interface LoadPayload {
  subject: string;
  body: string;
  resumeFile: File;
  resumeFilename: string;
  resumeName: string;
}

interface Props {
  currentSubject: string;
  currentBody: string;
  currentResumeFile: File | null;
  currentResumeFilename: string;
  // Page is responsible for setting state and advancing the wizard step.
  onLoad: (payload: LoadPayload) => void;
}

const STORAGE_KEY = "email-blaster-slots";

function loadSlots(): Slot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveSlots(s: Slot[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
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

export function SavedSlotsBar({
  currentSubject, currentBody, currentResumeFile, currentResumeFilename, onLoad,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => { setSlots(loadSlots()); }, []);

  const canSave = !!(currentSubject.trim() && currentBody.trim() && currentResumeFile);

  async function handleSave() {
    setError("");
    if (!canSave || !currentResumeFile) {
      setError("Need subject + body + resume before saving a slot.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await fileToBase64(currentResumeFile);
      const slot: Slot = {
        id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
        name: name.trim() || `Slot ${slots.length + 1}`,
        subject: currentSubject,
        body: currentBody,
        resumeName: currentResumeFile.name,
        resumeFilename: currentResumeFilename,
        resumeBase64: base64,
        resumeSize: currentResumeFile.size,
        savedAt: new Date().toISOString(),
      };
      const next = [...slots, slot];
      saveSlots(next);
      setSlots(next);
      setName("");
      setShowSaveModal(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad(slot: Slot) {
    setError(""); setLoadingId(slot.id);
    try {
      const file = base64ToFile(slot.resumeBase64, slot.resumeName);
      // Re-upload to the server so resumeFilename is valid for the next send.
      const fd = new FormData();
      fd.append("resume", file);
      let serverFilename = slot.resumeFilename;
      try {
        const res = await fetch("/api/upload-resume", { method: "POST", body: fd });
        const data = await res.json();
        if (data.filename) serverFilename = data.filename;
      } catch {}
      onLoad({
        subject: slot.subject,
        body: slot.body,
        resumeFile: file,
        resumeFilename: serverFilename,
        resumeName: slot.resumeName,
      });
    } catch (e) {
      setError(`Load failed: ${e}`);
    } finally {
      setLoadingId("");
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this saved slot?")) return;
    const next = slots.filter((s) => s.id !== id);
    saveSlots(next);
    setSlots(next);
  }

  return (
    <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-xl p-3 sm:p-4 mb-4">
      <div className="flex items-start sm:items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-indigo-400" />
          <span className="text-sm sm:text-base font-semibold text-indigo-300">Quick Slots</span>
          <span className="text-[11px] text-slate-500">({slots.length} saved)</span>
        </div>
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          disabled={!canSave}
          className="px-3 py-2 sm:py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/25 inline-flex items-center gap-1.5 disabled:opacity-40 active:scale-[0.98] transition"
          title={canSave ? "Save current template + resume as a slot" : "Need subject, body, and a resume first"}
        >
          <Plus size={14} /> Save current
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">
          No saved slots yet. Fill in the email + attach a resume, then tap <span className="text-indigo-300">Save current</span> — it bundles both into one slot you can re-load anytime in one tap.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {slots.map((slot, idx) => {
            const isLoading = loadingId === slot.id;
            return (
              <div
                key={slot.id}
                className="relative bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 hover:border-indigo-500/40 transition group"
              >
                <button
                  type="button"
                  onClick={() => handleLoad(slot)}
                  disabled={isLoading}
                  className="w-full text-left flex items-start gap-3 disabled:opacity-50"
                >
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold inline-flex items-center justify-center text-sm">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : `#${idx + 1}`}
                  </span>
                  <div className="min-w-0 flex-1 pr-7">
                    <p className="text-sm font-semibold text-white truncate">{slot.name}</p>
                    <p className="text-xs text-slate-400 truncate inline-flex items-center gap-1 mt-0.5">
                      <Mail size={11} className="shrink-0" />
                      <span className="truncate">{slot.subject || "(no subject)"}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate inline-flex items-center gap-1 mt-0.5">
                      <FileBox size={11} className="shrink-0" />
                      <span className="truncate">{slot.resumeName}</span>
                      <span className="text-slate-600 shrink-0">· {(slot.resumeSize / 1024).toFixed(0)} KB</span>
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(slot.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition"
                  aria-label={`Delete ${slot.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

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
              <p className="text-slate-200 truncate inline-flex items-center gap-2">
                <Mail size={14} className="text-violet-400 shrink-0" />
                <span className="truncate">{currentSubject || "(no subject)"}</span>
              </p>
              <p className="text-slate-200 truncate inline-flex items-center gap-2">
                <FileBox size={14} className="text-amber-400 shrink-0" />
                <span className="truncate">{currentResumeFile?.name || "(no resume)"}</span>
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Slot name (optional)</label>
              <input
                className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2"
                placeholder={`Slot ${slots.length + 1}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">Tip: name it after the role — e.g. &quot;Python Backend&quot; or &quot;AI/ML&quot;.</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1">
              <button onClick={() => setShowSaveModal(false)} className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 sm:border-0 rounded-lg sm:rounded">Cancel</button>
              <button
                onClick={handleSave}
                disabled={busy || !canSave}
                className="w-full sm:w-auto btn-primary py-3 sm:py-2 text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Save size={16} /> {busy ? "Saving…" : "Save slot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
