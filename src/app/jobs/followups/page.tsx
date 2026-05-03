"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Send, CheckCircle2, Loader2 } from "lucide-react";
import { fetchFollowUps, fetchTemplates, loadSavedSmtp, markFollowUpDone, sendApplications } from "../_lib/client";
import { getValidAccessToken, loadOAuth } from "@/lib/oauth";
import type { FollowUpEntry, Template } from "@/lib/jobAppShared";

export default function FollowUpsPage() {
  const [days, setDays] = useState(7);
  const [items, setItems] = useState<FollowUpEntry[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busyId, setBusyId] = useState<string>("");
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const [fu, tpls] = await Promise.all([fetchFollowUps(days), fetchTemplates()]);
      setItems(fu);
      setTemplates(tpls);
    } catch (e) { setError(String(e)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const followUpTemplate = templates.find((t) => (t.roleType || "").toLowerCase().includes("follow"));

  async function handleSendFollowUp(item: FollowUpEntry) {
    setError("");
    if (!followUpTemplate) {
      setError("No follow-up template found. Add one with role-type containing 'follow' on the Templates page.");
      return;
    }
    const oauth = loadOAuth();
    const token = oauth ? await getValidAccessToken() : null;
    const smtp = loadSavedSmtp();
    if (!token && !(smtp?.smtpUser && smtp?.smtpPass)) {
      setError("No sending credentials. Sign in with Google or set SMTP on the main page first.");
      return;
    }

    setBusyId(item.id);
    try {
      const r = await sendApplications({
        templateId: followUpTemplate.id,
        contactIds: [item.contactId],
        resumeId: item.resumeId,
        isFollowUp: true,
        oauthAccessToken: token || undefined,
        oauthEmail: oauth?.email || undefined,
        smtpUser: smtp?.smtpUser, smtpPass: smtp?.smtpPass,
        smtpHost: smtp?.smtpHost, smtpPort: smtp?.smtpPort, smtpSecurity: smtp?.smtpSecurity,
      });
      if (r.failed === 0) {
        await markFollowUpDone(item.id);
        refresh();
      } else {
        setError(r.results.find((x) => x.status === "failed")?.error || "Send failed.");
      }
    } catch (e) { setError(String(e)); }
    finally { setBusyId(""); }
  }

  async function handleResolve(id: string) {
    await markFollowUpDone(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Bell className="w-5 h-5 text-amber-400" /> Follow-ups</h2>
          <p className="text-sm text-slate-400">Sends with no follow-up after N days are surfaced here.</p>
        </div>
        <label className="text-sm text-slate-400 flex items-center gap-2">
          Threshold:
          <input type="number" min={3} max={30} value={days} onChange={(e) => setDays(parseInt(e.target.value || "7"))} className="w-16 input" />
          days
        </label>
      </div>

      {error && <p className="text-rose-400 text-sm">{error}</p>}
      {!followUpTemplate && (
        <p className="text-amber-300 text-sm">
          No follow-up template found. <Link href="/jobs/templates" className="underline">Create one</Link> with role-type <code>follow up</code>.
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-slate-500 text-sm">All caught up.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="border border-slate-800 bg-slate-900/40 rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{it.contactName || it.contactEmail}</p>
                  <p className="text-xs text-slate-500">{it.contactEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{it.role || "—"} <span className="text-slate-500">at</span> {it.company || "—"}</p>
                  <p className="text-xs text-amber-300">{it.daysSinceSent} days ago</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Sent with template <span className="text-slate-300">{it.templateName || "—"}</span>
                {it.resumeLabel && <> and resume <span className="text-slate-300">{it.resumeLabel}</span></>}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleSendFollowUp(it)}
                  disabled={busyId === it.id || !followUpTemplate}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
                >
                  {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Send follow-up
                </button>
                <button onClick={() => handleResolve(it.id)} className="inline-flex items-center gap-2 border border-slate-700 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded text-sm">
                  <CheckCircle2 className="w-3 h-3" /> Mark resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          background: rgb(15 23 42 / 0.6);
          border: 1px solid rgb(30 41 59);
          border-radius: 0.375rem;
          padding: 0.25rem 0.5rem;
          color: rgb(241 245 249);
          font-size: 0.875rem;
        }
        :global(.input:focus) { outline: 1px solid rgb(99 102 241); }
      `}</style>
    </div>
  );
}
