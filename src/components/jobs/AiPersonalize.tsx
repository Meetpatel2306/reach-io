"use client";

import { useRef, useState } from "react";
import { Sparkles, Loader2, ShieldAlert, Paperclip, Upload } from "lucide-react";

// AI-personalised draft generator (Gemini, with Groq as automatic backup).
// The AI only writes the subject line + a company-specific hook and picks which
// real project to lead with — the server renders the final body from a fixed,
// always-true template. The result lands in the compose editor below for the
// user to review and edit. Nothing is ever auto-sent.

export interface AiDraft {
  subject: string;
  body: string;
  recipient: { name: string; email: string; company: string; role: string };
}

interface Result {
  provider: string;
  reason: string;
  format?: string;
  resumeHint?: string;
  sentToday?: number;
  dailyCap?: number;
}

const FORMAT_LABELS: Record<string, string> = {
  ai: "AI Engineer template",
  backend: "Python Developer template",
  fixed: "minimal format",
};

export function AiPersonalize({
  onGenerated,
  resumeFile,
  resumeFilename,
  onResumeUpload,
}: {
  onGenerated: (draft: AiDraft) => void;
  // The resume already picked/saved on the Resume step (second priority).
  resumeFile?: File | null;
  resumeFilename?: string | null;
  // Called when the user uploads a resume right here (first priority) so the
  // compose flow attaches the same file when sending.
  onResumeUpload?: (file: File) => void;
}) {
  const [company, setCompany] = useState("");
  const [uploadedResume, setUploadedResume] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [jdText, setJdText] = useState("");
  const [format, setFormat] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blocks, setBlocks] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  // The generated draft sits here for review/editing — it only becomes the
  // sendable email when the user confirms with "Use this email".
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function generate() {
    setBusy(true); setError(""); setBlocks([]); setResult(null);
    setHasDraft(false); setConfirmed(false);
    try {
      const fd = new FormData();
      fd.append("company", company);
      fd.append("roleTitle", roleTitle);
      fd.append("recipientName", recipientName);
      fd.append("recipientTitle", recipientTitle);
      fd.append("recipientEmail", recipientEmail);
      fd.append("jdText", jdText);
      fd.append("format", format);
      // Resume priority: 1) uploaded right here, 2) the saved/picked one.
      if (uploadedResume && uploadedResume.size > 0) {
        fd.append("resumeFile", uploadedResume);
      } else if (resumeFile && resumeFile.size > 0) {
        fd.append("resumeFile", resumeFile);
      } else if (resumeFilename) {
        fd.append("resumeFilename", resumeFilename);
      }
      const res = await fetch("/api/ai/personalize", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      if (data.blocked) {
        setBlocks(data.blockReasons || ["Blocked."]);
        return;
      }
      setResult({ provider: data.provider, reason: data.reason, format: data.format, resumeHint: data.resumeHint, sentToday: data.sentToday, dailyCap: data.dailyCap });
      setDraftSubject(data.subject);
      setDraftBody(data.body);
      setHasDraft(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
      <div className="px-4 pb-4 space-y-3 pt-3">
          <p className="text-xs text-slate-400">
            Fill these in, hit Generate — the AI writes a personalised draft in your template format. You review and
            edit it below before anything is sent.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Company *</label>
              <input className="input-field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme AI" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Role title</label>
              <input className="input-field" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="AI Engineer" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Recipient name</label>
              <input className="input-field" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Priya Shah" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Recipient title</label>
              <input className="input-field" value={recipientTitle} onChange={(e) => setRecipientTitle(e.target.value)} placeholder="Engineering Lead" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Recipient email</label>
              <input className="input-field" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="priya@acme.ai — a real person, not hr@" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Email format</label>
            <select className="input-field" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="auto">Auto — pick from the job description (recommended)</option>
              <option value="ai">AI Engineer template</option>
              <option value="backend">Python Developer template</option>
              <option value="fixed">Minimal (short generic format)</option>
            </select>
          </div>

          {/* Resume used for this email — uploaded here beats the saved pick */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2.5">
            <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-1 min-w-0">
              <Paperclip size={13} className="shrink-0 text-slate-500" />
              {uploadedResume
                ? <>Resume: <span className="text-emerald-300 truncate">{uploadedResume.name}</span> (uploaded here)</>
                : (resumeFile && resumeFile.size > 0) || resumeFilename
                  ? <>Resume: <span className="text-slate-300 truncate">{resumeFile?.name || resumeFilename?.replace(/^(job)?resume_[^_]*_/, "")}</span> (from Resume step)</>
                  : <>No resume yet — upload one here or pick one on the Resume step.</>}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-200 text-xs hover:bg-violet-500/20 transition"
            >
              <Upload size={12} /> Upload resume
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploadedResume(f);
                onResumeUpload?.(f);
                e.target.value = "";
              }}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Job description (optional)</label>
            <textarea
              className="input-field"
              rows={6}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description for an AI-personalised opening line. Leave empty to get your matching template instantly."
            />
          </div>

          <button
            onClick={generate}
            disabled={busy || !company.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? "Writing draft..." : "Generate draft"}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {blocks.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1.5">
              <p className="text-sm font-medium text-red-300 flex items-center gap-1.5">
                <ShieldAlert size={15} /> Not sending this one:
              </p>
              {blocks.map((b, i) => (
                <p key={i} className="text-xs text-red-200/90">• {b}</p>
              ))}
            </div>
          )}

          {hasDraft && (
            <div className="rounded-xl border border-violet-500/40 bg-slate-900/60 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-violet-200">✉️ New generated email — review &amp; edit</p>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">nothing sent yet</span>
              </div>
              {result?.reason && <p className="text-xs text-slate-400">Why this angle: {result.reason}</p>}
              {result?.resumeHint && <p className="text-xs text-amber-200/90">📎 {result.resumeHint}</p>}
              <div>
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Subject</label>
                <input className="input-field" value={draftSubject} onChange={(e) => { setDraftSubject(e.target.value); setConfirmed(false); }} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Body</label>
                <textarea className="input-field" rows={12} value={draftBody} onChange={(e) => { setDraftBody(e.target.value); setConfirmed(false); }} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    onGenerated({
                      subject: draftSubject,
                      body: draftBody,
                      recipient: { name: recipientName, email: recipientEmail, company, role: roleTitle },
                    });
                    setConfirmed(true);
                  }}
                  className="btn-primary flex items-center justify-center gap-1.5"
                >
                  ✓ Use this email
                </button>
                <button
                  onClick={() => { setHasDraft(false); setConfirmed(false); }}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm hover:bg-slate-700 transition"
                >
                  Discard
                </button>
                <button
                  onClick={generate}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-200 text-sm hover:bg-violet-500/20 transition disabled:opacity-50"
                >
                  ↻ Regenerate
                </button>
              </div>
              {confirmed && (
                <p className="text-xs text-emerald-300">
                  Loaded into the email step — press Save &amp; Continue below, then send from the Send step.
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                Written by {result?.provider === "template" ? "your template (instant — no JD given)" : result?.provider === "groq" ? "Groq (backup — Gemini was unavailable)" : "Gemini"}
                {result?.format ? ` · ${FORMAT_LABELS[result.format] || result.format}` : ""}
                {typeof result?.sentToday === "number" ? ` · ${result.sentToday}/${result.dailyCap} sends today` : ""}
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
