"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Send, Loader2 } from "lucide-react";
import type { FollowUpEntry, Template } from "@/lib/jobAppShared";
import { loadOAuth, getValidAccessToken } from "@/lib/oauth";

interface SmtpStored {
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecurity?: string;
}

function loadSmtp(): SmtpStored | null {
  try { return JSON.parse(localStorage.getItem("email-blaster-smtp") || "null"); } catch { return null; }
}

export function FollowUpsPanel() {
  const [days, setDays] = useState(7);
  const [items, setItems] = useState<FollowUpEntry[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busyId, setBusyId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const refresh = async () => {
    try {
      const [fuRes, tplRes] = await Promise.all([
        fetch(`/api/jobs/followups?days=${days}`, { cache: "no-store" }),
        fetch("/api/jobs/templates", { cache: "no-store" }),
      ]);
      const fu = await fuRes.json();
      const tpls = await tplRes.json();
      if (Array.isArray(fu.followUps)) setItems(fu.followUps);
      if (Array.isArray(tpls.templates)) setTemplates(tpls.templates);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const followUpTpl = templates.find((t) => (t.roleType || "").toLowerCase().includes("follow"));

  async function handleResolve(id: string) {
    await fetch(`/api/jobs/followups/${id}/done`, { method: "POST" });
    refresh();
  }

  async function handleSendFollowUp(it: FollowUpEntry) {
    if (!followUpTpl) {
      setError("No follow-up template found. Create one in Email step (Templates → save with role-type 'follow up').");
      return;
    }
    const oauth = loadOAuth();
    const token = oauth ? await getValidAccessToken() : null;
    const smtp = loadSmtp();
    if (!token && !(smtp?.smtpUser && smtp?.smtpPass)) {
      setError("No sending credentials. Sign in with Google or set SMTP first.");
      return;
    }

    setBusyId(it.id); setError("");
    try {
      const fd = new FormData();
      fd.append("recipients", JSON.stringify([{
        name: it.contactName,
        email: it.contactEmail,
        company: it.company,
        role: it.role,
      }]));
      fd.append("subject", followUpTpl.subject);
      fd.append("body", followUpTpl.body);
      fd.append("minDelay", "0");
      fd.append("maxDelay", "0");
      if (it.resumeId) {
        // Look up the resume by id to get the storedFilename.
        const resumesRes = await fetch("/api/jobs/resumes", { cache: "no-store" });
        const resumesData = await resumesRes.json();
        const r = (resumesData.resumes || []).find((x: { id: string; storedFilename: string }) => x.id === it.resumeId);
        if (r?.storedFilename) fd.append("resumeFilename", r.storedFilename);
      }
      if (token) {
        fd.append("oauthAccessToken", token);
        fd.append("oauthEmail", oauth?.email || "");
      } else if (smtp) {
        fd.append("smtpHost", smtp.smtpHost || "smtp.gmail.com");
        fd.append("smtpPort", smtp.smtpPort || "587");
        fd.append("smtpUser", smtp.smtpUser || "");
        fd.append("smtpPass", smtp.smtpPass || "");
        fd.append("smtpSecurity", smtp.smtpSecurity || "starttls");
      }
      const res = await fetch("/api/send-email", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.failed > 0) throw new Error(data.results?.[0]?.error || "Send failed");
      await fetch(`/api/jobs/followups/${it.id}/done`, { method: "POST" });
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId("");
    }
  }

  if (!loaded) return null;
  if (items.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full p-4 flex items-center justify-between gap-3 hover:bg-amber-500/5"
      >
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-amber-400" />
          <div className="text-left">
            <p className="text-sm font-bold text-white">{items.length} follow-up{items.length === 1 ? "" : "s"} due</p>
            <p className="text-xs text-amber-200/70">Sent {days}+ days ago with no follow-up.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-amber-200/70 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            after
            <input type="number" min={3} max={30} value={days} onChange={(e) => setDays(parseInt(e.target.value || "7"))} className="w-12 bg-slate-900/50 border border-slate-700 rounded px-1 py-0.5 text-xs text-amber-200" />
            d
          </label>
          <span className="text-xs text-amber-200">{collapsed ? "Show" : "Hide"}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-amber-500/20 divide-y divide-amber-500/10">
          {error && <p className="px-4 py-2 text-xs text-red-400">{error}</p>}
          {items.map((it) => (
            <div key={it.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  <span className="font-medium">{it.contactName || it.contactEmail}</span>
                  <span className="text-slate-500"> — {it.role || "—"} at {it.company || "—"}</span>
                </p>
                <p className="text-xs text-amber-200/70">
                  Sent {it.daysSinceSent}d ago · {it.resumeLabel || "no resume"} · subject: {it.subject || "—"}
                </p>
              </div>
              <button
                onClick={() => handleSendFollowUp(it)}
                disabled={busyId === it.id || !followUpTpl}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs hover:bg-amber-500/25 inline-flex items-center gap-1.5 disabled:opacity-40"
                title={!followUpTpl ? "No follow-up template found" : ""}
              >
                {busyId === it.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Send follow-up
              </button>
              <button
                onClick={() => handleResolve(it.id)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-xs hover:bg-slate-700 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 size={12} /> Resolve
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
