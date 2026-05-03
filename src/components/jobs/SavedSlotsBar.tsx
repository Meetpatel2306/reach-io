"use client";

// Quick Slots — bundle a (template + resume) pair into a numbered slot.
// Slots live in server-side KV scoped to the user — sync across devices on login.
// First-load auto-migrates any old localStorage slots up to the server.

import { useEffect, useState } from "react";
import { Star, Plus, Trash2, FileBox, Mail, Loader2, X, Save, Cloud, Check } from "lucide-react";
import type { Slot } from "@/lib/jobAppShared";

const LEGACY_KEY = "email-blaster-slots";       // old localStorage key
const MIGRATION_FLAG = "email-blaster-slots-migrated-v1";

interface LoadPayload {
  subject: string;
  body: string;
  resumeFile: File;
  resumeFilename: string;
  resumeName: string;
  // Raw slot data — kept around so the send path can decode a fresh File at
  // send time, bypassing any chance of stale React state.
  resumeBase64: string;
}

interface Props {
  currentSubject: string;
  currentBody: string;
  currentResumeFile: File | null;
  currentResumeFilename: string;
  onLoad: (payload: LoadPayload) => void;
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

interface LegacySlot {
  id?: string;
  name?: string;
  subject?: string;
  body?: string;
  resumeName?: string;
  resumeBase64?: string;
  resumeSize?: number;
}

async function migrateLegacySlots(): Promise<number> {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return 0;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return 0;
    }
    const parsed: LegacySlot[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return 0;
    }
    let migrated = 0;
    for (const s of parsed) {
      if (!s.name || !s.subject || !s.body || !s.resumeBase64) continue;
      const res = await fetch("/api/jobs/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          subject: s.subject,
          body: s.body,
          resumeName: s.resumeName || "resume.pdf",
          resumeBase64: s.resumeBase64,
          resumeSize: s.resumeSize || 0,
        }),
      });
      if (res.ok) migrated++;
    }
    localStorage.setItem(MIGRATION_FLAG, "1");
    if (migrated > 0) localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return 0;
  }
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
  const [loaded, setLoaded] = useState(false);
  const [migrationMsg, setMigrationMsg] = useState("");
  const [activeSlotId, setActiveSlotId] = useState<string>("");
  const [activeSnapshot, setActiveSnapshot] = useState<{ subject: string; body: string; resumeName: string } | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch("/api/jobs/slots", { cache: "no-store" });
      const data = await r.json();
      if (Array.isArray(data.slots)) setSlots(data.slots);
    } catch (e) {
      setError(`Could not load slots: ${e}`);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    (async () => {
      const migrated = await migrateLegacySlots();
      if (migrated > 0) setMigrationMsg(`Synced ${migrated} local slot${migrated === 1 ? "" : "s"} to your account.`);
      await refresh();
    })();
  }, []);

  // Clear "in use" highlight when the user edits away from the loaded slot's content.
  useEffect(() => {
    if (!activeSlotId || !activeSnapshot) return;
    const drift =
      currentSubject !== activeSnapshot.subject ||
      currentBody !== activeSnapshot.body ||
      (currentResumeFile?.name || "") !== activeSnapshot.resumeName;
    if (drift) {
      setActiveSlotId("");
      setActiveSnapshot(null);
    }
  }, [currentSubject, currentBody, currentResumeFile, activeSlotId, activeSnapshot]);

  const canSave = !!(currentSubject.trim() && currentBody.trim() && currentResumeFile);

  async function handleSave() {
    setError("");
    if (!canSave || !currentResumeFile) {
      setError("Need subject + body + resume before saving a slot.");
      return;
    }
    setBusy(true);
    try {
      // The current resumeFile may be a zero-byte placeholder (created when the
      // user picked a saved resume in ResumesPicker — only the `size` field is
      // faked). Read the real blob; if it's empty, fall back to the server-stored
      // copy via currentResumeFilename so the slot gets actual bytes baked in.
      let blob: Blob = currentResumeFile;
      let realSize = (await currentResumeFile.arrayBuffer()).byteLength;
      if (realSize === 0 && currentResumeFilename) {
        const res = await fetch(`/api/upload-resume?name=${encodeURIComponent(currentResumeFilename)}`);
        if (res.ok) {
          blob = await res.blob();
          realSize = blob.size;
        }
      }
      if (realSize === 0) {
        throw new Error("Resume content is empty. Re-upload the resume, then save this slot.");
      }
      const fileForBase64 = new File([blob], currentResumeFile.name, { type: currentResumeFile.type || "application/pdf" });
      const base64 = await fileToBase64(fileForBase64);
      const r = await fetch("/api/jobs/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `Slot ${slots.length + 1}`,
          subject: currentSubject,
          body: currentBody,
          resumeName: currentResumeFile.name,
          resumeBase64: base64,
          resumeSize: realSize,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      setName("");
      setShowSaveModal(false);
      await refresh();
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
      if (file.size === 0) {
        throw new Error(`Slot "${slot.name}" has no resume content. Re-upload your resume in step 1, then save this slot again.`);
      }
      // Re-upload to the server so resumeFilename is valid for the next send.
      const fd = new FormData();
      fd.append("resume", file);
      let serverFilename = "";
      try {
        const res = await fetch("/api/upload-resume", { method: "POST", body: fd });
        const data = await res.json();
        serverFilename = data.filename || "";
      } catch {}
      // Use the slot's content verbatim — subject, body, and resume bytes flow
      // straight to the send pipeline; the parent's send handler picks them up
      // without re-validating.
      onLoad({
        subject: slot.subject,
        body: slot.body,
        resumeFile: file,
        resumeFilename: serverFilename,
        resumeName: slot.resumeName,
        resumeBase64: slot.resumeBase64,
      });
      setActiveSlotId(slot.id);
      setActiveSnapshot({ subject: slot.subject, body: slot.body, resumeName: slot.resumeName });
    } catch (e) {
      setError(`Load failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoadingId("");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved slot? (It will be removed from all your devices.)")) return;
    try {
      await fetch(`/api/jobs/slots/${id}`, { method: "DELETE" });
      if (id === activeSlotId) {
        setActiveSlotId("");
        setActiveSnapshot(null);
      }
      await refresh();
    } catch (e) { setError(String(e)); }
  }

  return (
    <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-xl p-3 sm:p-4 mb-4">
      <div className="flex items-start sm:items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Star size={18} className="text-indigo-400" />
          <span className="text-sm sm:text-base font-semibold text-indigo-300">Quick Slots</span>
          <span className="text-[11px] text-slate-500">({slots.length} saved)</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Slots sync to your account, available on every device">
            <Cloud size={10} /> synced
          </span>
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

      {migrationMsg && (
        <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1 mb-2">
          ✓ {migrationMsg}
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-slate-500 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading slots…</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-slate-500">
          No saved slots yet. Fill in the email + attach a resume, then tap <span className="text-indigo-300">Save current</span> — it bundles both into one slot you can re-load anytime in one tap.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {slots.map((slot, idx) => {
            const isLoading = loadingId === slot.id;
            const isActive = slot.id === activeSlotId;
            return (
              <div
                key={slot.id}
                className={`relative rounded-xl p-3 transition group ${
                  isActive
                    ? "bg-indigo-500/15 border border-indigo-400 ring-2 ring-indigo-400/60 shadow-[0_0_0_1px_rgba(129,140,248,0.4)]"
                    : "bg-slate-900/50 border border-slate-700/50 hover:border-indigo-500/40"
                }`}
              >
                {isActive && (
                  <span className="absolute -top-2 left-3 px-1.5 py-0.5 rounded-md bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow">
                    <Check size={10} /> In use
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleLoad(slot)}
                  disabled={isLoading}
                  className="w-full text-left flex items-start gap-3 disabled:opacity-50"
                >
                  <span className={`shrink-0 w-9 h-9 rounded-lg font-bold inline-flex items-center justify-center text-sm border ${
                    isActive
                      ? "bg-indigo-500 border-indigo-400 text-white"
                      : "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                  }`}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : `#${idx + 1}`}
                  </span>
                  <div className="min-w-0 flex-1 pr-7">
                    <p className={`text-sm font-semibold truncate ${isActive ? "text-indigo-100" : "text-white"}`}>{slot.name}</p>
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
