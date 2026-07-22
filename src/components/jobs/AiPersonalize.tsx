"use client";

import { useState } from "react";
import { Sparkles, Loader2, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";

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
  sentToday?: number;
  dailyCap?: number;
}

const FORMAT_LABELS: Record<string, string> = {
  ai: "AI Engineer template",
  backend: "Python Developer template",
  fixed: "minimal format",
};

export function AiPersonalize({ onGenerated }: { onGenerated: (draft: AiDraft) => void }) {
  const [open, setOpen] = useState(true);
  const [company, setCompany] = useState("");
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

  async function generate() {
    setBusy(true); setError(""); setBlocks([]); setResult(null);
    try {
      const res = await fetch("/api/ai/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, roleTitle, recipientName, recipientTitle, recipientEmail, jdText, format }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      if (data.blocked) {
        setBlocks(data.blockReasons || ["Blocked."]);
        return;
      }
      setResult({ provider: data.provider, reason: data.reason, format: data.format, sentToday: data.sentToday, dailyCap: data.dailyCap });
      onGenerated({
        subject: data.subject,
        body: data.body,
        recipient: { name: recipientName, email: recipientEmail, company, role: roleTitle },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-violet-500/5 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-200">
          <Sparkles size={16} className="text-violet-400" />
          AI-personalised email (paste the job description)
        </span>
        {open ? <ChevronUp size={16} className="text-violet-300" /> : <ChevronDown size={16} className="text-violet-300" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-violet-500/20 pt-3">
          <p className="text-xs text-slate-400">
            The AI writes only the subject + a hook proving the email was written for this company, and picks which of
            your real projects to lead with. Review and edit the draft below before sending — it never auto-sends.
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

          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Job description *</label>
            <textarea
              className="input-field"
              rows={6}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here — the more company-specific text, the better the hook."
            />
          </div>

          <button
            onClick={generate}
            disabled={busy || !company.trim() || jdText.trim().length < 80}
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

          {result && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
              <p className="text-sm text-emerald-300 font-medium">
                Draft loaded into the editor below — review it before sending.
              </p>
              {result.reason && <p className="text-xs text-emerald-200/80">Why this angle: {result.reason}</p>}
              <p className="text-[11px] text-emerald-200/60">
                Written by {result.provider === "groq" ? "Groq (backup — Gemini was unavailable)" : "Gemini"}
                {result.format ? ` · ${FORMAT_LABELS[result.format] || result.format}` : ""}
                {typeof result.sentToday === "number" ? ` · ${result.sentToday}/${result.dailyCap} sends today` : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
