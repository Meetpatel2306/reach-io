"use client";

// Quick Slots — bundle a (template + resume) pair into a numbered slot.
// Slots live in server-side KV scoped to the user — sync across devices on login.
// First-load auto-migrates any old localStorage slots up to the server.

import { useEffect, useState } from "react";
import { Star, Plus, Trash2, FileBox, Mail, Loader2, X, Save, Cloud, Check, FileText } from "lucide-react";
import type { Slot, Template } from "@/lib/jobAppShared";

// What we render as a "slot card" — either a real Slot from KV, or a Template
// that has a baked-in resume (so it can act like a slot).
interface SlotCard {
  source: "slot" | "template";
  id: string;
  name: string;
  subject: string;
  body: string;
  resumeName: string;
  resumeBase64: string;
  resumeSize: number;
  // Only present for source === "slot" (used by the delete button)
  realSlotId?: string;
}

const LEGACY_KEY = "email-blaster-slots";       // old localStorage key
const MIGRATION_FLAG = "email-blaster-slots-migrated-v1";

interface LoadPayload {
  subject: string;
  body: string;
  // Resume is optional — slots can be template-only.
  resumeFile: File | null;
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
  const [templateCards, setTemplateCards] = useState<SlotCard[]>([]);
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
      const [slotRes, tplRes] = await Promise.all([
        fetch("/api/jobs/slots", { cache: "no-store" }),
        fetch("/api/jobs/templates", { cache: "no-store" }),
      ]);
      const slotData = await slotRes.json();
      const tplData = await tplRes.json();
      if (Array.isArray(slotData.slots)) setSlots(slotData.slots);
      if (Array.isArray(tplData.templates)) {
        // Surface only templates that have a baked-in resume — those can be
        // used like slots (one tap = template + resume).
        const usable: SlotCard[] = (tplData.templates as Template[])
          .filter((t) => t.resumeBase64 && t.resumeName)
          .map((t) => ({
            source: "template" as const,
            id: `tpl:${t.id}`,
            name: t.name,
            subject: t.subject,
            body: t.body,
            resumeName: t.resumeName!,
            resumeBase64: t.resumeBase64!,
            resumeSize: t.resumeSize || 0,
          }));
        setTemplateCards(usable);
      }
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

  // Resume is OPTIONAL now — only subject + body are required.
  const canSave = !!(currentSubject.trim() && currentBody.trim());

  async function handleSave() {
    setError("");
    if (!canSave) {
      setError("Need at least a subject and body before saving a slot.");
      return;
    }
    setBusy(true);
    try {
      // Optionally bake a resume into the slot.
      let resumePayload: { resumeName: string; resumeBase64: string; resumeSize: number } = {
        resumeName: "",
        resumeBase64: "",
        resumeSize: 0,
      };

      if (currentResumeFile) {
        let blob: Blob = currentResumeFile;
        let realSize = (await currentResumeFile.arrayBuffer()).byteLength;
        if (realSize === 0 && currentResumeFilename) {
          const res = await fetch(`/api/upload-resume?name=${encodeURIComponent(currentResumeFilename)}`);
          if (res.ok) {
            blob = await res.blob();
            realSize = blob.size;
          }
        }
        if (realSize > 0) {
          const fileForBase64 = new File([blob], currentResumeFile.name, { type: currentResumeFile.type || "application/pdf" });
          resumePayload = {
            resumeName: currentResumeFile.name,
            resumeBase64: await fileToBase64(fileForBase64),
            resumeSize: realSize,
          };
        }
      }

      const r = await fetch("/api/jobs/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `Slot ${slots.length + 1}`,
          subject: currentSubject,
          body: currentBody,
          ...resumePayload,
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

  async function handleLoadCard(card: SlotCard) {
    setError(""); setLoadingId(card.id);
    try {
      const hasResume = !!(card.resumeBase64 && card.resumeName);
      let file: File | null = null;
      let serverFilename = "";
      if (hasResume) {
        file = base64ToFile(card.resumeBase64, card.resumeName);
        if (file.size > 0) {
          const fd = new FormData();
          fd.append("resume", file);
          try {
            const res = await fetch("/api/upload-resume", { method: "POST", body: fd });
            const data = await res.json();
            serverFilename = data.filename || "";
          } catch {}
        } else {
          file = null;
        }
      }
      onLoad({
        subject: card.subject,
        body: card.body,
        resumeFile: file,
        resumeFilename: serverFilename,
        resumeName: card.resumeName,
        resumeBase64: card.resumeBase64,
      });
      setActiveSlotId(card.id);
      setActiveSnapshot({ subject: card.subject, body: card.body, resumeName: card.resumeName });
    } catch (e) {
      setError(`Load failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoadingId("");
    }
  }

  async function handleDelete(card: SlotCard) {
    if (card.source === "template") {
      // Templates are managed on the /templates page — don't delete them here.
      alert("This is a template, not a slot. Edit or delete it from the Templates page.");
      return;
    }
    if (!confirm("Delete this saved slot? (It will be removed from all your devices.)")) return;
    try {
      await fetch(`/api/jobs/slots/${card.realSlotId}`, { method: "DELETE" });
      if (card.id === activeSlotId) {
        setActiveSlotId("");
        setActiveSnapshot(null);
      }
      await refresh();
    } catch (e) { setError(String(e)); }
  }

  // Merge both sources into a single list for rendering.
  // Real slots first, then template-derived cards.
  const cards: SlotCard[] = [
    ...slots.map<SlotCard>((s) => ({
      source: "slot",
      id: s.id,
      realSlotId: s.id,
      name: s.name,
      subject: s.subject,
      body: s.body,
      resumeName: s.resumeName || "",
      resumeBase64: s.resumeBase64 || "",
      resumeSize: s.resumeSize || 0,
    })),
    ...templateCards,
  ];

  return (
    <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-xl p-3 sm:p-4 mb-4">
      <div className="flex items-start sm:items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Star size={18} className="text-indigo-400" />
          <span className="text-sm sm:text-base font-semibold text-indigo-300">Quick Slots</span>
          <span className="text-[11px] text-slate-500">({cards.length} total · {slots.length} saved + {templateCards.length} from templates)</span>
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
      ) : cards.length === 0 ? (
        <p className="text-sm text-slate-500">
          No slots yet. Fill in the email + attach a resume, then tap <span className="text-indigo-300">Save current</span>. Templates with a baked-in resume also appear here automatically.
        </p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-3 sm:-mx-4 px-3 sm:px-4 snap-x snap-mandatory" style={{ scrollbarWidth: "thin" }}>
          {cards.map((card, idx) => {
            const isLoading = loadingId === card.id;
            const isActive = card.id === activeSlotId;
            const fromTemplate = card.source === "template";
            return (
              <div
                key={card.id}
                className={`relative shrink-0 w-64 sm:w-72 snap-start rounded-xl p-3 transition group ${
                  isActive
                    ? "bg-indigo-500/15 border border-indigo-400 ring-2 ring-indigo-400/60 shadow-[0_0_0_1px_rgba(129,140,248,0.4)]"
                    : fromTemplate
                      ? "bg-violet-500/5 border border-violet-500/30 hover:border-violet-500/50"
                      : "bg-slate-900/50 border border-slate-700/50 hover:border-indigo-500/40"
                }`}
              >
                {isActive && (
                  <span className="absolute -top-2 left-3 px-1.5 py-0.5 rounded-md bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow">
                    <Check size={10} /> In use
                  </span>
                )}
                {!isActive && fromTemplate && (
                  <span className="absolute -top-2 left-3 px-1.5 py-0.5 rounded-md bg-violet-500 text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow">
                    <FileText size={10} /> Template
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleLoadCard(card)}
                  disabled={isLoading}
                  className="w-full text-left flex items-start gap-3 disabled:opacity-50 min-w-0"
                >
                  <span className={`shrink-0 w-9 h-9 rounded-lg font-bold inline-flex items-center justify-center text-sm border ${
                    isActive
                      ? "bg-indigo-500 border-indigo-400 text-white"
                      : fromTemplate
                        ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                        : "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                  }`}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : `#${idx + 1}`}
                  </span>
                  <div className="min-w-0 flex-1 pr-7 overflow-hidden">
                    <p className={`text-sm font-semibold truncate ${isActive ? "text-indigo-100" : "text-white"}`}>{card.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400 min-w-0">
                      <Mail size={11} className="shrink-0" />
                      <span className="truncate min-w-0 flex-1">{card.subject || "(no subject)"}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 min-w-0">
                      <FileBox size={11} className="shrink-0" />
                      <span className="truncate min-w-0 flex-1">{card.resumeName || "no resume"}</span>
                      {card.resumeSize > 0 && (
                        <span className="text-slate-600 shrink-0">· {(card.resumeSize / 1024).toFixed(0)} KB</span>
                      )}
                    </div>
                  </div>
                </button>
                {!fromTemplate && (
                  <button
                    type="button"
                    onClick={() => handleDelete(card)}
                    className="absolute top-2 right-2 p-1.5 rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition"
                    aria-label={`Delete ${card.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
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
