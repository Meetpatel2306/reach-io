"use client";

import { useEffect, useRef, useState } from "react";
import { FileBox, Upload, Trash2, Save, Check } from "lucide-react";
import type { ResumeMeta } from "@/lib/jobAppShared";

interface Props {
  // Called when user picks a saved resume — passes the storedFilename so the existing
  // /api/send-email path can use it via the resumeFilename field.
  onPick: (resume: { storedFilename: string; filename: string; sizeBytes: number; label: string }) => void;
  // Currently active resume label so we can highlight the matching saved one.
  activeStoredFilename?: string;
}

export function ResumesPicker({ onPick, activeStoredFilename }: Props) {
  const [resumes, setResumes] = useState<ResumeMeta[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [label, setLabel] = useState("");
  const [roleType, setRoleType] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const r = await fetch("/api/jobs/resumes", { cache: "no-store" });
      const data = await r.json();
      if (Array.isArray(data.resumes)) setResumes(data.resumes);
    } catch {}
  };
  useEffect(() => { refresh(); }, []);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !label.trim()) {
      setMsg("File and label are required.");
      return;
    }
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("label", label);
    fd.append("roleType", roleType);
    try {
      const r = await fetch("/api/jobs/resumes", { method: "POST", body: fd });
      if (!r.ok) throw new Error((await r.json()).error || "Upload failed");
      setLabel(""); setRoleType("");
      if (fileRef.current) fileRef.current.value = "";
      setShowUpload(false);
      refresh();
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved resume?")) return;
    await fetch(`/api/jobs/resumes/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 sm:p-4 mb-4">
      <div className="flex items-start sm:items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileBox size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-amber-300 uppercase tracking-wider">Saved Resumes</span>
          <span className="text-[11px] text-slate-500">({resumes.length})</span>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          className="px-3 py-2 sm:py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm hover:bg-amber-500/20 inline-flex items-center gap-1.5 active:scale-[0.98] transition"
        >
          <Upload size={14} /> {showUpload ? "Cancel" : "Upload new"}
        </button>
      </div>

      {showUpload && (
        <div className="border border-amber-500/20 rounded-lg p-3 sm:p-4 bg-slate-900/40 space-y-3 mb-3">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="block w-full text-sm text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 file:text-sm" />
          <input className="input-field text-base sm:text-sm w-full py-3 sm:py-2" placeholder="Label (e.g. Python Backend v3)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="input-field text-base sm:text-sm w-full py-3 sm:py-2" placeholder="Role type (e.g. python backend developer)" value={roleType} onChange={(e) => setRoleType(e.target.value)} />
          <button onClick={handleUpload} disabled={busy} className="w-full sm:w-auto btn-primary py-3 sm:py-2.5 text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
            <Save size={16} /> {busy ? "Uploading…" : "Save resume"}
          </button>
          {msg && <p className="text-amber-300 text-sm">{msg}</p>}
        </div>
      )}

      {resumes.length === 0 && !showUpload ? (
        <p className="text-sm text-slate-500">No saved resumes. Upload new to add one for re-use later.</p>
      ) : (
        <div className="space-y-2 max-h-64 sm:max-h-48 overflow-y-auto">
          {resumes.map((r) => {
            const isActive = activeStoredFilename === r.storedFilename;
            return (
              <div key={r.id} className={`flex items-start sm:items-center gap-2 px-3 py-3 sm:py-2 rounded-lg text-sm ${isActive ? "bg-amber-500/10 border border-amber-500/30" : "border border-slate-700/30 hover:bg-slate-800/40"}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 truncate">{r.label}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {r.filename}
                    {r.roleType && <> · {r.roleType}</>}
                  </p>
                </div>
                {isActive ? (
                  <span className="text-amber-300 inline-flex items-center gap-1 text-xs shrink-0 px-2 py-1">
                    <Check size={12} /> in use
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPick({ storedFilename: r.storedFilename, filename: r.filename, sizeBytes: r.sizeBytes, label: r.label })}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-sm font-medium hover:bg-amber-500/25 shrink-0 active:scale-[0.98] transition"
                  >
                    Use
                  </button>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-red-400/70 hover:text-red-400 p-2 shrink-0"
                  aria-label="Delete saved resume"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
