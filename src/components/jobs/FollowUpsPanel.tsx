"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Loader2, MailCheck, RefreshCw, MessageSquareReply } from "lucide-react";
import { FOLLOW_UP_DAY, type FollowUpEntry } from "@/lib/jobAppShared";

// One-click threaded follow-ups. The server sends the fixed follow-up copy as a
// REPLY inside the original email thread (Re: subject + In-Reply-To headers),
// checks Gmail for a reply first (never nudges someone who already answered),
// and enforces "one follow-up, ever". No template setup needed.

export function FollowUpsPanel() {
  const [days, setDays] = useState(FOLLOW_UP_DAY);
  const [items, setItems] = useState<FollowUpEntry[]>([]);
  const [busyId, setBusyId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/jobs/followups?days=${days}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.followUps)) setItems(data.followUps);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  async function handleResolve(id: string) {
    await fetch(`/api/jobs/followups/${id}/done`, { method: "POST" });
    refresh();
  }

  async function handleCheckReplies() {
    setError(""); setNotice("");
    setCheckingReplies(true);
    try {
      const res = await fetch("/api/jobs/check-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysThreshold: days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reply check failed");
      setNotice(`Checked ${data.checked} · ${data.repliedCount} replied · ${data.pendingCount} still pending.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckingReplies(false);
    }
  }

  async function handleSendFollowUp(it: FollowUpEntry) {
    setBusyId(it.id); setError(""); setNotice("");
    try {
      const res = await fetch("/api/jobs/followups/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Follow-up failed");
      if (data.replied) {
        setNotice(`${it.contactName || it.contactEmail} already replied — resolved, no nudge sent.`);
      } else {
        setNotice(data.message || "Follow-up sent.");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
        className="w-full p-4 flex items-center justify-between gap-3 hover:bg-amber-500/5 active:bg-amber-500/10 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Bell size={20} className="text-amber-400 shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-base sm:text-sm font-bold text-white truncate">{items.length} follow-up{items.length === 1 ? "" : "s"} due</p>
            <p className="text-xs text-amber-200/70">Sent {days}+ days ago, no reply yet. One click replies in the same thread.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-amber-200/70 inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            after
            <input
              type="number"
              inputMode="numeric"
              min={3}
              max={30}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value || String(FOLLOW_UP_DAY)))}
              className="w-14 bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-sm text-amber-200"
            />
            d
          </label>
          <span className="text-sm text-amber-200">{collapsed ? "Show" : "Hide"}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-amber-500/20">
          <div className="px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-amber-500/5">
            <button
              onClick={handleCheckReplies}
              disabled={checkingReplies}
              className="w-full sm:w-auto px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-sm hover:bg-emerald-500/25 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
              title="Check your Gmail inbox for replies from each pending recipient"
            >
              {checkingReplies ? <Loader2 size={14} className="animate-spin" /> : <MailCheck size={14} />}
              {checkingReplies ? "Checking Gmail..." : "Check Gmail for replies"}
            </button>
            <button
              onClick={refresh}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm hover:bg-slate-700 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            {notice && <p className="text-xs text-emerald-300">{notice}</p>}
          </div>
          {error && <p className="px-4 py-2 text-sm text-red-400">{error}</p>}
          <div className="divide-y divide-amber-500/10">
          {items.map((it) => (
            <div key={it.id} className="p-3 sm:p-4 space-y-3">
              <div className="min-w-0">
                <p className="text-sm sm:text-base text-white">
                  <span className="font-medium">{it.contactName || it.contactEmail}</span>
                </p>
                <p className="text-xs sm:text-sm text-slate-400 truncate">
                  {it.role || "—"} <span className="text-slate-600">at</span> {it.company || "—"}
                </p>
                <p className="text-xs text-amber-200/70 mt-1">
                  Sent {it.daysSinceSent}d ago · &ldquo;{it.subject}&rdquo;
                  {it.messageId || it.threadId ? " · will reply in-thread" : " · pre-threading send (goes as Re: with same subject)"}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleSendFollowUp(it)}
                  disabled={busyId === it.id}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-sm font-medium hover:bg-amber-500/25 inline-flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.98] transition"
                  title="Checks Gmail for a reply first, then sends the follow-up inside the original thread"
                >
                  {busyId === it.id ? <Loader2 size={16} className="animate-spin" /> : <MessageSquareReply size={16} />}
                  {busyId === it.id ? "Sending..." : "Follow up (in-thread)"}
                </button>
                <button
                  onClick={() => handleResolve(it.id)}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm hover:bg-slate-700 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                >
                  <CheckCircle2 size={16} /> Resolve
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
