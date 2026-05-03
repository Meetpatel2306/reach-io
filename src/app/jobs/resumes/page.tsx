"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileBox } from "lucide-react";
import { fetchResumes, removeResume, uploadResume } from "../_lib/client";
import type { ResumeMeta } from "@/lib/jobAppShared";

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeMeta[]>([]);
  const [label, setLabel] = useState("");
  const [roleType, setRoleType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try { setResumes(await fetchResumes()); } catch (e) { setError(String(e)); }
  };
  useEffect(() => { refresh(); }, []);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !label.trim()) {
      setError("File and label are required.");
      return;
    }
    setBusy(true); setError("");
    try {
      await uploadResume(file, label, roleType);
      setLabel(""); setRoleType("");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this resume?")) return;
    await removeResume(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Resumes</h2>
        <p className="text-sm text-slate-400">Upload multiple resume PDFs and tag each with a role-type — the right one auto-attaches per send.</p>
      </div>

      <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40 space-y-3">
        <h3 className="font-medium">Upload</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="text-sm text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-200"
          />
          <input
            placeholder="Label (e.g. Python Backend v3)"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            placeholder="Role type (e.g. python backend developer)"
            className="input"
            value={roleType}
            onChange={(e) => setRoleType(e.target.value)}
          />
        </div>
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <button onClick={handleUpload} disabled={busy} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
          <Upload className="w-4 h-4" /> {busy ? "Uploading…" : "Upload resume"}
        </button>
      </div>

      <div className="space-y-2">
        {resumes.length === 0 && (
          <p className="text-slate-500 text-sm">No resumes uploaded.</p>
        )}
        {resumes.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 border border-slate-800 rounded-lg bg-slate-900/40">
            <FileBox className="w-5 h-5 text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.label}</p>
              <p className="text-xs text-slate-500 truncate">{r.filename} · role-type: {r.roleType || "—"} · {(r.sizeBytes / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={() => handleDelete(r.id)} className="text-rose-400 hover:text-rose-300">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

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
