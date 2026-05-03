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
    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileBox size={14} className="text-amber-400" />
          <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Saved Resumes</span>
          <span className="text-[10px] text-slate-500">({resumes.length} saved)</span>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/20 inline-flex items-center gap-1"
        >
          <Upload size={11} /> {showUpload ? "Cancel" : "Upload new"}
        </button>
      </div>

      {showUpload && (
        <div className="border border-amber-500/20 rounded-lg p-3 bg-slate-900/40 space-y-2 mb-2">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="text-xs text-slate-300 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs" />
          <input className="input-field text-xs w-full" placeholder="Label (e.g. Python Backend v3)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="input-field text-xs w-full" placeholder="Role type (e.g. python backend developer)" value={roleType} onChange={(e) => setRoleType(e.target.value)} />
          <button onClick={handleUpload} disabled={busy} className="btn-primary text-xs flex items-center gap-1.5">
            <Save size={12} /> {busy ? "Uploading…" : "Save resume"}
          </button>
          {msg && <p className="text-amber-300 text-xs">{msg}</p>}
        </div>
      )}

      {resumes.length === 0 && !showUpload ? (
        <p className="text-xs text-slate-500">No saved resumes. Click Upload new to add one for re-use later.</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {resumes.map((r) => {
            const isActive = activeStoredFilename === r.storedFilename;
            return (
              <div key={r.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${isActive ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-slate-800/40"}`}>
                <span className="flex-1 truncate">
                  <span className="text-slate-200">{r.label}</span>
                  <span className="text-slate-500"> · {r.filename}</span>
                  {r.roleType && <span className="text-slate-500"> · {r.roleType}</span>}
                </span>
                {isActive ? (
                  <span className="text-amber-300 inline-flex items-center gap-1"><Check size={11} /> in use</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPick({ storedFilename: r.storedFilename, filename: r.filename, sizeBytes: r.sizeBytes, label: r.label })}
                    className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs hover:bg-amber-500/25"
                  >
                    Use
                  </button>
                )}
                <button onClick={() => handleDelete(r.id)} className="text-red-400/70 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
