"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Send, Check, X, Trash2, Clock, Users,
  Paperclip, Mail, ChevronDown, ChevronUp, Search,
  Filter, Calendar, BarChart3, AlertCircle, Layers,
  ArrowUpDown, User, Hash, RefreshCw, AlertOctagon
} from "lucide-react";
import { loadHistory, clearHistory, deleteBatch } from "@/lib/history";
import type { SendBatch, EmailResult } from "@/lib/history";

// --- Helpers ---

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

// --- Types ---

type FilterType = "all" | "success" | "partial" | "failed";
type ViewMode = "batches" | "emails";
type SortField = "date" | "recipients" | "sent" | "failed" | "subject";
type SortDir = "asc" | "desc";
type EmailSortField = "email" | "name" | "totalSends" | "lastSent" | "successRate";

interface EmailGroup {
  email: string;
  name: string;
  sends: { timestamp: string; status: "sent" | "failed"; subject: string; error?: string; batchId: string; from: string }[];
  totalSends: number;
  successCount: number;
  failCount: number;
  lastSent: string;
  successRate: number;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<SendBatch[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [view, setView] = useState<ViewMode>("batches");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [emailSortField, setEmailSortField] = useState<EmailSortField>("email");
  const [emailSortDir, setEmailSortDir] = useState<SortDir>("asc");
  const [loaded, setLoaded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setLoaded(true);
  }, []);

  const refresh = () => setHistory(loadHistory());

  const handleClearAll = async () => {
    // Notify server so admin can see this user cleared their history
    try {
      await fetch("/api/history/mark-deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {}
    clearHistory();
    setHistory([]);
    setShowClearConfirm(false);
  };

  const handleDeleteBatch = async (id: string) => {
    // Notify server first so admin can see this batch was deleted by user
    try {
      await fetch("/api/history/mark-deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchIds: [id] }),
      });
    } catch {}
    deleteBatch(id);
    refresh();
    setDeleteBatchId(null);
  };

  // --- Batch filtering & sorting ---

  const filteredBatches = useMemo(() => {
    let items = [...history];

    // Filter
    if (filter === "success") items = items.filter((b) => b.failed === 0);
    else if (filter === "failed") items = items.filter((b) => b.sent === 0);
    else if (filter === "partial") items = items.filter((b) => b.failed > 0 && b.sent > 0);

    // Search
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((b) =>
        b.subject.toLowerCase().includes(q) ||
        b.from.toLowerCase().includes(q) ||
        b.results.some((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      );
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(); break;
        case "recipients": cmp = a.totalRecipients - b.totalRecipients; break;
        case "sent": cmp = a.sent - b.sent; break;
        case "failed": cmp = a.failed - b.failed; break;
        case "subject": cmp = a.subject.localeCompare(b.subject); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [history, filter, search, sortField, sortDir]);

  // --- Email grouping ---

  const emailGroups = useMemo(() => {
    const map = new Map<string, EmailGroup>();

    for (const batch of history) {
      for (const r of batch.results) {
        const key = r.email.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            email: r.email,
            name: r.name || "",
            sends: [],
            totalSends: 0,
            successCount: 0,
            failCount: 0,
            lastSent: batch.timestamp,
            successRate: 0,
          });
        }
        const g = map.get(key)!;
        if (r.name && !g.name) g.name = r.name;
        g.sends.push({
          timestamp: batch.timestamp,
          status: r.status,
          subject: batch.subject,
          error: r.error,
          batchId: batch.id,
          from: batch.from,
        });
        g.totalSends++;
        if (r.status === "sent") g.successCount++;
        else g.failCount++;
        if (new Date(batch.timestamp) > new Date(g.lastSent)) g.lastSent = batch.timestamp;
        g.successRate = Math.round((g.successCount / g.totalSends) * 100);
      }
    }

    // Sort sends within each group by date desc
    for (const g of map.values()) {
      g.sends.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    let groups = Array.from(map.values());

    // Search
    if (search) {
      const q = search.toLowerCase();
      groups = groups.filter((g) =>
        g.email.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q)
      );
    }

    // Filter
    if (filter === "success") groups = groups.filter((g) => g.failCount === 0);
    else if (filter === "failed") groups = groups.filter((g) => g.successCount === 0);
    else if (filter === "partial") groups = groups.filter((g) => g.failCount > 0 && g.successCount > 0);

    // Sort
    groups.sort((a, b) => {
      let cmp = 0;
      switch (emailSortField) {
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "name": cmp = (a.name || "zzz").localeCompare(b.name || "zzz"); break;
        case "totalSends": cmp = a.totalSends - b.totalSends; break;
        case "lastSent": cmp = new Date(a.lastSent).getTime() - new Date(b.lastSent).getTime(); break;
        case "successRate": cmp = a.successRate - b.successRate; break;
      }
      return emailSortDir === "asc" ? cmp : -cmp;
    });

    return groups;
  }, [history, search, filter, emailSortField, emailSortDir]);

  // --- Stats ---

  const totalEmails = history.reduce((a, b) => a + b.totalRecipients, 0);
  const totalSent = history.reduce((a, b) => a + b.sent, 0);
  const totalFailed = history.reduce((a, b) => a + b.failed, 0);
  const successRate = totalEmails > 0 ? Math.round((totalSent / totalEmails) * 100) : 0;
  const uniqueEmails = new Set(history.flatMap((b) => b.results.map((r) => r.email.toLowerCase()))).size;

  // --- Sort toggle helpers ---

  const toggleBatchSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "date" ? "desc" : "asc"); }
  };

  const toggleEmailSort = (field: EmailSortField) => {
    if (emailSortField === field) setEmailSortDir(emailSortDir === "asc" ? "desc" : "asc");
    else { setEmailSortField(field); setEmailSortDir(field === "email" || field === "name" ? "asc" : "desc"); }
  };

  if (!loaded) return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse">
          <Send size={20} className="text-white" />
        </div>
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Send History</h1>
            <p className="text-slate-500 text-xs">{history.length} batch{history.length !== 1 ? "es" : ""} &middot; {uniqueEmails} unique email{uniqueEmails !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {history.length > 0 && (
          <button onClick={() => setShowClearConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm hover:bg-red-500/20 transition-all">
            <Trash2 size={14} />Clear All
          </button>
        )}
      </div>

      {/* Stats */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { icon: Layers, label: "Batches", value: history.length, color: "text-violet-300", bg: "bg-violet-500/10 border-violet-500/20" },
            { icon: Users, label: "Unique Emails", value: uniqueEmails, color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/20" },
            { icon: Check, label: "Sent", value: totalSent, color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { icon: X, label: "Failed", value: totalFailed, color: "text-red-300", bg: "bg-red-500/10 border-red-500/20" },
            { icon: BarChart3, label: "Success Rate", value: `${successRate}%`, color: successRate >= 90 ? "text-emerald-300" : successRate >= 50 ? "text-amber-300" : "text-red-300", bg: successRate >= 90 ? "bg-emerald-500/10 border-emerald-500/20" : successRate >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-xl p-3 text-center border ${s.bg}`}>
                <Icon size={16} className={`${s.color} mx-auto mb-1`} />
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Controls: Search + Filter + View Toggle */}
      {history.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-10" placeholder="Search by subject, email, name, sender..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <button
                onClick={() => setView("batches")}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  view === "batches" ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300"
                }`}
              >
                <Layers size={13} />Batches
              </button>
              <button
                onClick={() => setView("emails")}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  view === "emails" ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300"
                }`}
              >
                <User size={13} />By Email
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-slate-500" />
            {(["all", "success", "partial", "failed"] as FilterType[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                filter === f ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300"
              }`}>
                {f}
              </button>
            ))}

            <span className="text-slate-700 mx-1">|</span>
            <ArrowUpDown size={13} className="text-slate-500" />

            {view === "batches" ? (
              <>
                {(["date", "recipients", "sent", "failed", "subject"] as SortField[]).map((f) => (
                  <button key={f} onClick={() => toggleBatchSort(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize flex items-center gap-1 ${
                    sortField === f ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300"
                  }`}>
                    {f}{sortField === f && (sortDir === "asc" ? " ↑" : " ↓")}
                  </button>
                ))}
              </>
            ) : (
              <>
                {(["email", "name", "totalSends", "lastSent", "successRate"] as EmailSortField[]).map((f) => {
                  const labels: Record<EmailSortField, string> = { email: "Email", name: "Name", totalSends: "Sends", lastSent: "Last Sent", successRate: "Rate" };
                  return (
                    <button key={f} onClick={() => toggleEmailSort(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                      emailSortField === f ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300"
                    }`}>
                      {labels[f]}{emailSortField === f && (emailSortDir === "asc" ? " ↑" : " ↓")}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {history.length === 0 && (
        <div className="glass-card text-center py-16">
          <Mail size={48} className="text-slate-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-400 mb-2">No emails sent yet</h2>
          <p className="text-sm text-slate-600 mb-6">Your send history will appear here after you send your first batch.</p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2"><Send size={16} />Start Sending</Link>
        </div>
      )}

      {/* No results */}
      {history.length > 0 && ((view === "batches" && filteredBatches.length === 0) || (view === "emails" && emailGroups.length === 0)) && (
        <div className="glass-card text-center py-12">
          <Search size={36} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">No results matching your search or filter.</p>
        </div>
      )}

      {/* ===== BATCHES VIEW ===== */}
      {view === "batches" && (
        <div className="space-y-3">
          {filteredBatches.map((batch) => {
            const isExpanded = expandedId === batch.id;
            const allSuccess = batch.failed === 0;
            const allFailed = batch.sent === 0;

            return (
              <div key={batch.id} className="glass-card !p-0 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : batch.id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    allSuccess ? "bg-emerald-500/10" : allFailed ? "bg-red-500/10" : "bg-amber-500/10"
                  }`}>
                    {allSuccess ? <Check size={18} className="text-emerald-400" /> :
                     allFailed ? <X size={18} className="text-red-400" /> :
                     <AlertCircle size={18} className="text-amber-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white truncate">{batch.subject}</p>
                      {batch.hasAttachment && <Paperclip size={11} className="text-violet-400 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Mail size={10} />{batch.from}</span>
                      <span className="flex items-center gap-1"><Calendar size={10} />{timeAgo(batch.timestamp)}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{formatDuration(batch.durationMs)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={12} />{batch.totalRecipients}</span>
                    <span className="badge badge-success"><Check size={10} />&nbsp;{batch.sent}</span>
                    {batch.failed > 0 && <span className="badge badge-error"><X size={10} />&nbsp;{batch.failed}</span>}
                    {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-900/30">
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Date</p><p className="text-sm text-slate-300">{formatDate(batch.timestamp)}</p></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Time</p><p className="text-sm text-slate-300">{formatTime(batch.timestamp)}</p></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Duration</p><p className="text-sm text-slate-300">{formatDuration(batch.durationMs)}</p></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Attachment</p><p className="text-sm text-slate-300">{batch.hasAttachment ? batch.attachmentName : "None"}</p></div>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-800/30">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Email Preview</p>
                      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                        <p className="text-xs text-slate-500 mb-1">Subject</p>
                        <p className="text-sm text-slate-200 mb-3">{batch.subject}</p>
                        <p className="text-xs text-slate-500 mb-1">Body</p>
                        <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto">{batch.body}</pre>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-800/30">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Recipients ({batch.results.length})</p>
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-700/30">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-slate-900/60 text-left text-[10px] text-slate-500 uppercase tracking-wider">
                            <th className="px-3 py-2">Status</th><th className="px-3 py-2">Email</th><th className="px-3 py-2 hidden md:table-cell">Name</th><th className="px-3 py-2 hidden md:table-cell">Error</th>
                          </tr></thead>
                          <tbody>
                            {batch.results.map((r, i) => (
                              <tr key={i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                                <td className="px-3 py-2">{r.status === "sent" ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={11} />Sent</span> : <span className="inline-flex items-center gap-1 text-xs text-red-400"><X size={11} />Failed</span>}</td>
                                <td className="px-3 py-2 text-violet-300 text-xs">{r.email}</td>
                                <td className="px-3 py-2 text-slate-400 text-xs hidden md:table-cell">{r.name || "—"}</td>
                                <td className="px-3 py-2 text-red-400/70 text-xs hidden md:table-cell">{r.error || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-800/30 flex justify-end">
                      <button onClick={() => setDeleteBatchId(batch.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs hover:bg-red-500/20 transition-all">
                        <Trash2 size={12} />Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== EMAILS VIEW (Grouped by email) ===== */}
      {view === "emails" && (
        <div className="space-y-3">
          {emailGroups.map((g) => {
            const isExpanded = expandedEmail === g.email;
            const allSuccess = g.failCount === 0;
            const allFailed = g.successCount === 0;

            return (
              <div key={g.email} className="glass-card !p-0 overflow-hidden">
                <button
                  onClick={() => setExpandedEmail(isExpanded ? null : g.email)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    allSuccess ? "bg-emerald-500/10" : allFailed ? "bg-red-500/10" : "bg-amber-500/10"
                  }`}>
                    {allSuccess ? <Check size={18} className="text-emerald-400" /> :
                     allFailed ? <X size={18} className="text-red-400" /> :
                     <AlertCircle size={18} className="text-amber-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-violet-300 truncate">{g.email}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      {g.name && <span className="flex items-center gap-1"><User size={10} />{g.name}</span>}
                      <span className="flex items-center gap-1"><Calendar size={10} />Last: {timeAgo(g.lastSent)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {g.totalSends > 1 && (
                      <span className="badge badge-info flex items-center gap-1"><RefreshCw size={10} />{g.totalSends}x</span>
                    )}
                    <span className="badge badge-success"><Check size={10} />&nbsp;{g.successCount}</span>
                    {g.failCount > 0 && <span className="badge badge-error"><X size={10} />&nbsp;{g.failCount}</span>}
                    <span className={`text-xs font-bold ${g.successRate >= 90 ? "text-emerald-400" : g.successRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                      {g.successRate}%
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800/50">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-900/30">
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total Sends</p><p className="text-sm text-slate-300 font-bold">{g.totalSends}</p></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Successful</p><p className="text-sm text-emerald-400 font-bold">{g.successCount}</p></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Failed</p><p className="text-sm text-red-400 font-bold">{g.failCount}</p></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">First Contact</p><p className="text-sm text-slate-300">{formatDate(g.sends[g.sends.length - 1].timestamp)}</p></div>
                    </div>

                    {/* Send history for this email */}
                    <div className="px-4 py-3 border-t border-slate-800/30">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Send History</p>
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-700/30">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-slate-900/60 text-left text-[10px] text-slate-500 uppercase tracking-wider">
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Subject</th>
                            <th className="px-3 py-2 hidden md:table-cell">From</th>
                            <th className="px-3 py-2 hidden md:table-cell">Error</th>
                          </tr></thead>
                          <tbody>
                            {g.sends.map((s, i) => (
                              <tr key={i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                                <td className="px-3 py-2">{s.status === "sent" ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={11} />Sent</span> : <span className="inline-flex items-center gap-1 text-xs text-red-400"><X size={11} />Failed</span>}</td>
                                <td className="px-3 py-2 text-xs text-slate-400">{formatDate(s.timestamp)} {formatTime(s.timestamp)}</td>
                                <td className="px-3 py-2 text-xs text-slate-300 truncate max-w-[200px]">{s.subject}</td>
                                <td className="px-3 py-2 text-xs text-slate-500 hidden md:table-cell">{s.from}</td>
                                <td className="px-3 py-2 text-xs text-red-400/70 hidden md:table-cell">{s.error || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Clear All Confirmation Popup */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}>
          <div className="glass-card max-w-sm w-full !border-red-500/30 text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon size={32} className="text-white" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Delete All History?</h2>
            <p className="text-sm text-slate-400 mb-2">This will permanently remove:</p>

            {/* Stats of what will be deleted */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-red-500/5 border border-red-500/15 rounded-lg py-2 px-3">
                <p className="text-lg font-bold text-red-300">{history.length}</p>
                <p className="text-[10px] text-slate-500 uppercase">Batches</p>
              </div>
              <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg py-2 px-3">
                <p className="text-lg font-bold text-orange-300">{totalSent + totalFailed}</p>
                <p className="text-[10px] text-slate-500 uppercase">Records</p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg py-2 px-3">
                <p className="text-lg font-bold text-amber-300">{uniqueEmails}</p>
                <p className="text-[10px] text-slate-500 uppercase">Emails</p>
              </div>
            </div>

            <p className="text-xs text-red-400/60 mb-6">This action cannot be undone.</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm font-semibold hover:bg-slate-700 transition-all"
              >
                <X size={16} />No, Keep It
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-semibold hover:from-red-600 hover:to-orange-600 transition-all shadow-lg shadow-red-500/20"
              >
                <Trash2 size={16} />Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Batch Confirmation */}
      {deleteBatchId && (() => {
        const batch = history.find((b) => b.id === deleteBatchId);
        if (!batch) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}>
            <div className="glass-card max-w-sm w-full !border-amber-500/30 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={26} className="text-white" />
              </div>

              <h2 className="text-lg font-bold text-white mb-2">Delete This Batch?</h2>

              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30 mb-4 text-left">
                <p className="text-xs text-slate-500 mb-1">Subject</p>
                <p className="text-sm text-slate-200 truncate mb-2">{batch.subject}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(batch.timestamp)}</span>
                  <span className="flex items-center gap-1"><Users size={11} />{batch.totalRecipients} recipients</span>
                  <span className="flex items-center gap-1 text-emerald-400"><Check size={11} />{batch.sent}</span>
                  {batch.failed > 0 && <span className="flex items-center gap-1 text-red-400"><X size={11} />{batch.failed}</span>}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteBatchId(null)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm font-semibold hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteBatch(deleteBatchId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
                >
                  <Trash2 size={14} />Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
