"use client";

// Shows "already emailed X times, last on Y" for a given recipient inline,
// plus an optional expanded list of past sends (subject, status, when).

import { useEffect, useMemo, useState } from "react";
import { Clock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { loadHistory, HISTORY_UPDATED_EVENT, type SendBatch } from "@/lib/history";

interface Match {
  timestamp: string;
  subject: string;
  status: "sent" | "failed";
  attachmentName: string;
}

function buildIndex(history: SendBatch[]): Map<string, Match[]> {
  const idx = new Map<string, Match[]>();
  for (const batch of history) {
    for (const r of batch.results || []) {
      const key = r.email.toLowerCase();
      const list = idx.get(key) || [];
      list.push({
        timestamp: batch.timestamp,
        subject: batch.subject,
        status: r.status,
        attachmentName: batch.attachmentName || "",
      });
      idx.set(key, list);
    }
  }
  // Sort each list newest-first
  for (const list of idx.values()) {
    list.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }
  return idx;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function useRecipientHistoryIndex() {
  const [index, setIndex] = useState<Map<string, Match[]>>(() => new Map());
  useEffect(() => {
    const refresh = () => setIndex(buildIndex(loadHistory()));
    refresh();
    // Re-build whenever a send completes (custom event from saveToHistory),
    // or when the history key changes from another tab (storage event), or
    // when the user returns to this tab (visibilitychange / focus).
    const onUpdate = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "email-blaster-history") refresh();
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(HISTORY_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onUpdate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(HISTORY_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onUpdate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return index;
}

export function RecipientHistoryBadge({
  email,
  index,
  compact = false,
}: {
  email: string;
  index: Map<string, Match[]>;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const matches = useMemo(() => index.get(email.toLowerCase()) || [], [email, index]);
  if (matches.length === 0) return null;

  const last = matches[0];
  const warn = matches.length >= 2; // already contacted multiple times = stronger warning

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
          warn
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
            : "bg-slate-700/40 border-slate-600/40 text-slate-300"
        }`}
        title={`${matches.length}× before · last ${timeAgo(last.timestamp)}`}
      >
        {warn ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {matches.length}× · {timeAgo(last.timestamp)}
      </button>
    );
  }

  return (
    <div className={`rounded-lg border text-xs ${warn ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-800/30 border-slate-700/40"}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {warn ? <AlertTriangle className="w-3 h-3 text-amber-300" /> : <Clock className="w-3 h-3 text-slate-400" />}
        <span className={warn ? "text-amber-200" : "text-slate-300"}>
          Already emailed <strong>{matches.length}×</strong> — last <strong>{timeAgo(last.timestamp)}</strong>
        </span>
      </button>
      {expanded && (
        <ul className="px-2 pb-2 space-y-1 max-h-40 overflow-y-auto">
          {matches.map((m, i) => (
            <li key={i} className="flex items-start gap-2 pl-4">
              <span className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${m.status === "sent" ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-slate-300 truncate">{m.subject || "(no subject)"}</span>
                <span className="text-slate-500 text-[10px]">
                  {new Date(m.timestamp).toLocaleString()} · {m.status}
                  {m.attachmentName && <> · 📎 {m.attachmentName}</>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
