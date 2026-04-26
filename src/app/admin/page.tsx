"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Shield, ShieldOff, Users, Search, Trash2, KeyRound, Crown, Calendar,
  Mail, Loader2, Check, X, AlertOctagon, Send, BarChart3, Activity,
  Filter, RefreshCw, ChevronDown, ChevronUp, UserPlus, Clock,
  Layers, TrendingUp, Zap, Eye, Paperclip, ExternalLink, Inbox,
  MessageSquare, User as UserIcon, Reply
} from "lucide-react";

const PRIMARY_ADMIN_EMAIL = "meetpatel4384@gmail.com";

interface User {
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt?: string;
  sessionMaxAgeMs?: number;
}

interface ServerBatch {
  id: string;
  userEmail: string;
  userName: string;
  timestamp: string;
  subject: string;
  body: string;
  from: string;
  method: string;
  hasAttachment: boolean;
  attachmentName: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  results: { email: string; name: string; status: string; error?: string }[];
  deletedByUser?: boolean;
  deletedAt?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso?: string) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

type TabId = "overview" | "activity" | "users" | "emails" | "support";

interface TicketReply {
  from: "user" | "admin";
  fromName: string;
  message: string;
  timestamp: string;
}

interface SupportTicket {
  id: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: "open" | "resolved";
  priority: "low" | "normal" | "high";
  category: "bug" | "question" | "feature" | "other";
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [batches, setBatches] = useState<ServerBatch[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "partial" | "failed" | "deleted">("all");
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.json());
        if (me.user?.role !== "admin") {
          router.push("/login");
          return;
        }
        setCurrentAdminEmail(me.user.email || "");
        setAuthorized(true);
        await loadAll();
      } catch {
        router.push("/login");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    setRefreshing(true);
    const [usersRes, batchesRes, ticketsRes] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/all-batches").then((r) => r.json()),
      fetch("/api/admin/support").then((r) => r.json()),
    ]);
    if (usersRes.users) setUsers(usersRes.users);
    if (batchesRes.batches) setBatches(batchesRes.batches);
    if (ticketsRes.tickets) setTickets(ticketsRes.tickets);
    setRefreshing(false);
  };

  const handleAdminReply = async (ticketId: string, status?: "open" | "resolved") => {
    if (!replyText.trim() && !status) return;
    setSendingReply(true);
    try {
      await fetch("/api/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, message: replyText || "(status changed)", status }),
      });
      setReplyText("");
      setReplyTo(null);
      await loadAll();
    } catch {}
    setSendingReply(false);
  };

  const handleResolveTicket = async (ticketId: string, status: "open" | "resolved") => {
    try {
      await fetch("/api/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, message: status === "resolved" ? "Marked as resolved by admin." : "Reopened by admin.", status }),
      });
      await loadAll();
    } catch {}
  };

  const handlePromote = async (email: string) => {
    const res = await fetch("/api/admin/promote-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setActionMsg(data.message || data.error || "");
    if (res.ok) await loadAll();
  };

  const handleDemote = async (email: string) => {
    const res = await fetch("/api/admin/demote-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setActionMsg(data.message || data.error || "");
    if (res.ok) await loadAll();
  };

  const handleResetPassword = async (email: string) => {
    if (!newPassword || newPassword.length < 6) {
      setActionMsg("Password must be at least 6 characters");
      return;
    }
    const res = await fetch("/api/admin/reset-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword }),
    });
    const data = await res.json();
    setActionMsg(data.message || data.error || "");
    if (res.ok) { setResettingEmail(null); setNewPassword(""); }
  };

  const handleDeleteUser = async (email: string) => {
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setActionMsg(data.error || `Deleted ${email}`);
    if (res.ok) { setConfirmDelete(null); await loadAll(); }
  };

  // ==== Stats ====
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const totalBatches = batches.length;
    const totalEmailsSent = batches.reduce((a, b) => a + b.sent, 0);
    const totalEmailsFailed = batches.reduce((a, b) => a + b.failed, 0);
    const totalRecipients = batches.reduce((a, b) => a + b.totalRecipients, 0);
    const successRate = totalRecipients > 0 ? Math.round((totalEmailsSent / totalRecipients) * 100) : 0;
    const uniqueRecipients = new Set(batches.flatMap((b) => b.results.map((r) => r.email.toLowerCase()))).size;
    const newUsersThisWeek = users.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length;
    const activeToday = users.filter((u) => u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() < 24 * 60 * 60 * 1000).length;
    const batchesToday = batches.filter((b) => Date.now() - new Date(b.timestamp).getTime() < 24 * 60 * 60 * 1000).length;
    const oauthBatches = batches.filter((b) => b.method === "oauth").length;
    const deletedBatches = batches.filter((b) => b.deletedByUser).length;
    return {
      totalUsers, admins, totalBatches, totalEmailsSent, totalEmailsFailed,
      totalRecipients, successRate, uniqueRecipients, newUsersThisWeek,
      activeToday, batchesToday, oauthBatches, deletedBatches,
    };
  }, [users, batches]);

  // Per-user breakdown
  const userBreakdown = useMemo(() => {
    return users.map((u) => {
      const userBatches = batches.filter((b) => b.userEmail === u.email);
      const sent = userBatches.reduce((a, b) => a + b.sent, 0);
      const failed = userBatches.reduce((a, b) => a + b.failed, 0);
      const recipients = userBatches.reduce((a, b) => a + b.totalRecipients, 0);
      return { user: u, batches: userBatches.length, sent, failed, recipients, lastSend: userBatches[0]?.timestamp };
    }).sort((a, b) => b.sent - a.sent);
  }, [users, batches]);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    let arr = [...batches];
    if (filterUser !== "all") arr = arr.filter((b) => b.userEmail === filterUser);
    if (filterStatus === "success") arr = arr.filter((b) => b.failed === 0 && b.sent > 0);
    if (filterStatus === "partial") arr = arr.filter((b) => b.failed > 0 && b.sent > 0);
    if (filterStatus === "failed") arr = arr.filter((b) => b.sent === 0);
    if (filterStatus === "deleted") arr = arr.filter((b) => b.deletedByUser);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((b) =>
        b.subject.toLowerCase().includes(q) ||
        b.userEmail.toLowerCase().includes(q) ||
        b.userName.toLowerCase().includes(q) ||
        b.from.toLowerCase().includes(q) ||
        b.results.some((r) => r.email.toLowerCase().includes(q))
      );
    }
    return arr;
  }, [batches, filterUser, filterStatus, search]);

  // All emails sent (flat list across all batches)
  const allEmails = useMemo(() => {
    const items = batches.flatMap((b) =>
      b.results.map((r) => ({
        recipientEmail: r.email,
        recipientName: r.name,
        status: r.status,
        error: r.error,
        senderEmail: b.userEmail,
        senderName: b.userName,
        subject: b.subject,
        timestamp: b.timestamp,
        batchId: b.id,
      }))
    );
    if (search) {
      const q = search.toLowerCase();
      return items.filter((i) =>
        i.recipientEmail.toLowerCase().includes(q) ||
        i.recipientName.toLowerCase().includes(q) ||
        i.senderEmail.toLowerCase().includes(q) ||
        i.subject.toLowerCase().includes(q)
      );
    }
    return items;
  }, [batches, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-red-500/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-900/60 backdrop-blur text-slate-400 hover:text-amber-300 hover:border-amber-500/30 transition-all">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <button onClick={loadAll} disabled={refreshing} className="p-2 rounded-lg bg-slate-900/60 backdrop-blur border border-slate-700/50 text-slate-400 hover:text-violet-300">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              <span className="text-xs text-amber-400/80 uppercase tracking-widest flex items-center gap-1.5">
                <Crown size={12} />Admin Console
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Shield size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm text-slate-400">Full visibility — every user, every email, every send</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${actionMsg.includes("Deleted") || actionMsg.includes("reset") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg("")} className="opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {([
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "activity", label: "All Activity", icon: Activity, count: batches.length },
          { id: "users", label: "Users", icon: Users, count: users.length },
          { id: "emails", label: "All Emails", icon: Inbox, count: allEmails.length },
          { id: "support", label: "Support", icon: MessageSquare, count: tickets.filter((t) => t.status === "open").length },
        ] as { id: TabId; label: string; icon: typeof BarChart3; count?: number }[]).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                  : "bg-slate-800/40 text-slate-400 border-slate-700/40 hover:text-slate-200"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.count !== undefined && (
                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  activeTab === t.id ? "bg-amber-500/30 text-amber-200" : "bg-slate-700/50 text-slate-300"
                }`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { icon: Users, label: "Total Users", value: stats.totalUsers, sub: `${stats.admins} admin`, color: "violet" },
              { icon: Send, label: "Emails Sent", value: stats.totalEmailsSent, sub: `${stats.totalEmailsFailed} failed`, color: "emerald" },
              { icon: Layers, label: "Send Batches", value: stats.totalBatches, sub: `${stats.batchesToday} today`, color: "blue" },
              { icon: TrendingUp, label: "Success Rate", value: `${stats.successRate}%`, sub: `${stats.totalRecipients} total recipients`, color: stats.successRate >= 90 ? "emerald" : stats.successRate >= 50 ? "amber" : "red" },
            ].map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { icon: UserPlus, label: "New Users (7d)", value: stats.newUsersThisWeek, sub: "this week", color: "cyan" },
              { icon: Activity, label: "Active Today", value: stats.activeToday, sub: "logged in 24h", color: "blue" },
              { icon: Zap, label: "OAuth Sends", value: stats.oauthBatches, sub: `${stats.totalBatches - stats.oauthBatches} via SMTP`, color: "amber" },
              { icon: Mail, label: "Unique Recipients", value: stats.uniqueRecipients, sub: "distinct emails", color: "pink" },
              { icon: Trash2, label: "User-Deleted", value: stats.deletedBatches, sub: "hidden from user", color: "red" },
            ].map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Per-user leaderboard */}
          <div className="glass-card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-amber-400" />
                Per-User Activity
              </h2>
              <span className="text-xs text-slate-500">Sorted by emails sent</span>
            </div>
            {userBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No users yet.</p>
            ) : (
              <div className="space-y-2">
                {userBreakdown.map((u) => (
                  <div key={u.user.email} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                      u.user.role === "admin" ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-violet-500 to-indigo-500"
                    }`}>
                      {(u.user.name || u.user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">{u.user.name || u.user.email.split("@")[0]}</p>
                        {u.user.role === "admin" && <Crown size={11} className="text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{u.user.email}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                      <div>
                        <p className="text-xs font-bold text-emerald-400">{u.sent}</p>
                        <p className="text-[9px] text-slate-500 uppercase">Sent</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-red-400">{u.failed}</p>
                        <p className="text-[9px] text-slate-500 uppercase">Failed</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-400">{u.batches}</p>
                        <p className="text-[9px] text-slate-500 uppercase">Batches</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-[10px] text-slate-500 uppercase">Last send</p>
                      <p className="text-[11px] text-slate-300">{timeAgo(u.lastSend)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity preview */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={18} className="text-violet-400" />
                Recent Activity
              </h2>
              <button onClick={() => setActiveTab("activity")} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                View all <ExternalLink size={11} />
              </button>
            </div>
            <div className="space-y-2">
              {batches.slice(0, 5).map((b) => (
                <BatchRow key={b.id} batch={b} expanded={false} onToggle={() => setActiveTab("activity")} />
              ))}
              {batches.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No sends yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ALL ACTIVITY TAB */}
      {activeTab === "activity" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-10" placeholder="Search subject, user, recipient..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field !w-auto" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option value="all">All Users</option>
              {users.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name ? `${u.name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
            <select className="input-field !w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}>
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="deleted">User-Deleted</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredBatches.map((b) => (
              <BatchRow
                key={b.id}
                batch={b}
                expanded={expandedBatch === b.id}
                onToggle={() => setExpandedBatch(expandedBatch === b.id ? null : b.id)}
              />
            ))}
            {filteredBatches.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-12">No batches match filters.</p>
            )}
          </div>
        </>
      )}

      {/* USERS TAB */}
      {activeTab === "users" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-10" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            {users
              .filter((u) => !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase()))
              .map((user) => (
                <UserCard
                  key={user.email}
                  user={user}
                  batchCount={batches.filter((b) => b.userEmail === user.email).length}
                  currentAdminEmail={currentAdminEmail}
                  onResetPassword={() => { setResettingEmail(user.email); setNewPassword(""); }}
                  onDelete={() => setConfirmDelete(user.email)}
                  onPromote={() => handlePromote(user.email)}
                  onDemote={() => handleDemote(user.email)}
                  isResetting={resettingEmail === user.email}
                  newPassword={newPassword}
                  setNewPassword={setNewPassword}
                  onConfirmReset={() => handleResetPassword(user.email)}
                  onCancelReset={() => { setResettingEmail(null); setNewPassword(""); }}
                />
              ))}
          </div>
        </>
      )}

      {/* ALL EMAILS TAB */}
      {activeTab === "emails" && (
        <>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input-field pl-10" placeholder="Search any recipient, sender, subject..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="glass-card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60 sticky top-0">
                  <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Recipient</th>
                    <th className="px-3 py-3 hidden sm:table-cell">Subject</th>
                    <th className="px-3 py-3 hidden md:table-cell">Sender</th>
                    <th className="px-3 py-3 hidden md:table-cell">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {allEmails.slice(0, 500).map((e, i) => (
                    <tr key={i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                      <td className="px-3 py-2">
                        {e.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={11} />Sent</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-400" title={e.error}><X size={11} />Failed</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-violet-300">{e.recipientEmail}</p>
                        {e.recipientName && <p className="text-[10px] text-slate-500">{e.recipientName}</p>}
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell text-xs text-slate-300 max-w-[200px] truncate">{e.subject}</td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <p className="text-xs text-slate-400">{e.senderName || e.senderEmail.split("@")[0]}</p>
                        <p className="text-[10px] text-slate-600 truncate">{e.senderEmail}</p>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell text-[11px] text-slate-500">{timeAgo(e.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allEmails.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-12">No emails sent yet.</p>
            )}
            {allEmails.length > 500 && (
              <p className="text-xs text-slate-500 text-center py-3 border-t border-slate-800/30">Showing 500 of {allEmails.length}. Refine search to see more.</p>
            )}
          </div>
        </>
      )}

      {/* SUPPORT TAB */}
      {activeTab === "support" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-10" placeholder="Search subject, message, user..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field !w-auto" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option value="all">All Users</option>
              {users.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name ? `${u.name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            let filteredTickets = tickets;
            if (filterUser !== "all") filteredTickets = filteredTickets.filter((t) => t.userEmail === filterUser);
            if (search) {
              const q = search.toLowerCase();
              filteredTickets = filteredTickets.filter((t) =>
                t.subject.toLowerCase().includes(q) ||
                t.message.toLowerCase().includes(q) ||
                t.userEmail.toLowerCase().includes(q) ||
                t.userName.toLowerCase().includes(q) ||
                t.replies.some((r) => r.message.toLowerCase().includes(q))
              );
            }
            return filteredTickets.length === 0 ? (
              <div className="glass-card text-center py-12">
                <MessageSquare size={48} className="text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400">{tickets.length === 0 ? "No support tickets yet." : "No tickets match the current filters."}</p>
              </div>
            ) : (<>{
            filteredTickets.map((t) => {
              const isOpen = t.status === "open";
              return (
                <div key={t.id} className={`glass-card !p-0 overflow-hidden ${isOpen ? "!border-amber-500/30" : "opacity-80"}`}>
                  <div className="p-4 flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isOpen ? "bg-amber-500/15" : "bg-emerald-500/10"
                    }`}>
                      {isOpen ? <MessageSquare size={18} className="text-amber-400" /> : <Check size={18} className="text-emerald-400" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-white">{t.subject}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border capitalize ${
                          t.priority === "high" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                          t.priority === "low" ? "bg-slate-700/50 text-slate-400 border-slate-700" :
                          "bg-violet-500/20 text-violet-300 border-violet-500/30"
                        }`}>{t.priority}</span>
                        <span className="text-[9px] bg-slate-700/50 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded-full capitalize">{t.category}</span>
                        {!isOpen && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">Resolved</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
                        <span className="text-violet-300 font-medium">{t.userName || t.userEmail.split("@")[0]}</span>
                        <span>•</span>
                        <span>{t.userEmail}</span>
                        <span>•</span>
                        <span>{timeAgo(t.createdAt)}</span>
                      </div>

                      {/* Original message */}
                      <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30 mb-2">
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans">{t.message}</pre>
                      </div>

                      {/* Replies */}
                      {t.replies.length > 0 && (
                        <div className="space-y-2 mb-2">
                          {t.replies.map((r, i) => (
                            <div key={i} className={`rounded-lg p-3 border ${
                              r.from === "admin"
                                ? "bg-amber-500/5 border-amber-500/20 ml-6"
                                : "bg-slate-800/40 border-slate-700/30 mr-6"
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                {r.from === "admin" ? (
                                  <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1"><Crown size={10} />{r.fromName}</span>
                                ) : (
                                  <span className="text-[10px] text-violet-300 font-semibold flex items-center gap-1"><UserIcon size={10} />{r.fromName}</span>
                                )}
                                <span className="text-[10px] text-slate-600">{timeAgo(r.timestamp)}</span>
                              </div>
                              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans">{r.message}</pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply form */}
                      {isOpen && (
                        <div className="mt-3">
                          {replyTo === t.id ? (
                            <div className="space-y-2">
                              <textarea
                                rows={3}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Type your reply..."
                                className="input-field !text-xs"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button onClick={() => { setReplyTo(null); setReplyText(""); }} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs">Cancel</button>
                                <button
                                  onClick={() => handleAdminReply(t.id)}
                                  disabled={sendingReply || !replyText.trim()}
                                  className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/40 text-xs font-semibold flex-1 flex items-center justify-center gap-1"
                                >
                                  {sendingReply ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                  Send Reply
                                </button>
                                <button
                                  onClick={() => handleAdminReply(t.id, "resolved")}
                                  disabled={sendingReply}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
                                >
                                  Reply & Resolve
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => setReplyTo(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/30 text-xs hover:bg-violet-500/20">
                                <Reply size={12} />Reply
                              </button>
                              <button onClick={() => handleResolveTicket(t.id, "resolved")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs hover:bg-emerald-500/20">
                                <Check size={12} />Mark Resolved
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {!isOpen && (
                        <button onClick={() => handleResolveTicket(t.id, "open")} className="text-xs text-slate-500 hover:text-amber-300 mt-2">
                          Reopen ticket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
            }</>);
          })()}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}>
          <div className="glass-card max-w-sm w-full !border-red-500/30 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Delete User?</h2>
            <p className="text-sm text-amber-300 font-mono mb-6">{confirmDelete}</p>
            <p className="text-xs text-red-400/60 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm font-semibold hover:bg-slate-700">Cancel</button>
              <button onClick={() => handleDeleteUser(confirmDelete)} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-semibold shadow-lg shadow-red-500/20">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: typeof BarChart3;
  label: string;
  value: number | string;
  sub: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, sub, color }: StatCardProps) {
  const colorMap: Record<string, { text: string; gradient: string; border: string }> = {
    violet: { text: "text-violet-300", gradient: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/30" },
    emerald: { text: "text-emerald-300", gradient: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30" },
    blue: { text: "text-blue-300", gradient: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/30" },
    amber: { text: "text-amber-300", gradient: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/30" },
    red: { text: "text-red-300", gradient: "from-red-500/20 to-red-500/5", border: "border-red-500/30" },
    cyan: { text: "text-cyan-300", gradient: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/30" },
    pink: { text: "text-pink-300", gradient: "from-pink-500/20 to-pink-500/5", border: "border-pink-500/30" },
  };
  const c = colorMap[color] || colorMap.violet;
  return (
    <div className={`bg-gradient-to-br ${c.gradient} backdrop-blur rounded-2xl p-4 border ${c.border}`}>
      <Icon size={18} className={`${c.text} mb-2`} />
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
      <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

interface BatchRowProps {
  batch: ServerBatch;
  expanded: boolean;
  onToggle: () => void;
}

function BatchRow({ batch, expanded, onToggle }: BatchRowProps) {
  const allSuccess = batch.failed === 0;
  const allFailed = batch.sent === 0;
  const isDeleted = !!batch.deletedByUser;

  return (
    <div className={`glass-card !p-0 overflow-hidden ${isDeleted ? "!border-red-500/30 opacity-80" : ""}`}>
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isDeleted ? "bg-red-500/10" :
          allSuccess ? "bg-emerald-500/10" : allFailed ? "bg-red-500/10" : "bg-amber-500/10"
        }`}>
          {isDeleted ? <Trash2 size={16} className="text-red-400" /> :
           allSuccess ? <Check size={16} className="text-emerald-400" /> :
           allFailed ? <X size={16} className="text-red-400" /> :
           <AlertOctagon size={16} className="text-amber-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-sm font-semibold text-white truncate ${isDeleted ? "line-through text-slate-400" : ""}`}>{batch.subject}</p>
            {batch.hasAttachment && <Paperclip size={11} className="text-violet-400 shrink-0" />}
            {batch.method === "oauth" && <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full shrink-0">OAuth</span>}
            {isDeleted && (
              <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                <Trash2 size={9} />Deleted by user
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
            <span className="text-violet-300">{batch.userName || batch.userEmail.split("@")[0]}</span>
            <span>{batch.userEmail}</span>
            <span>{timeAgo(batch.timestamp)}</span>
            {isDeleted && batch.deletedAt && (
              <span className="text-red-400/80">Deleted {timeAgo(batch.deletedAt)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={11} />{batch.totalRecipients}</span>
          <span className="badge badge-success"><Check size={10} />&nbsp;{batch.sent}</span>
          {batch.failed > 0 && <span className="badge badge-error"><X size={10} />&nbsp;{batch.failed}</span>}
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800/50 p-4 space-y-3 bg-slate-900/20">
          {/* User-deleted notice */}
          {isDeleted && batch.deletedAt && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <Trash2 size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="text-red-300 font-semibold">Deleted from user&apos;s history</p>
                <p className="text-slate-400 mt-0.5">
                  {batch.userName || batch.userEmail} removed this batch on {formatDate(batch.deletedAt)} at {formatTime(batch.deletedAt)}.
                  Visible only to admin. The user can no longer see this in their own history view.
                </p>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Detail label="From" value={batch.from} />
            <Detail label="Sent" value={`${formatDate(batch.timestamp)} ${formatTime(batch.timestamp)}`} />
            <Detail label="Method" value={batch.method.toUpperCase()} />
            <Detail label="Attachment" value={batch.hasAttachment ? batch.attachmentName : "None"} />
          </div>

          {/* Body preview */}
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Email body</p>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto">{batch.body}</pre>
          </div>

          {/* Recipients table */}
          <div className="rounded-lg border border-slate-700/30 overflow-hidden">
            <div className="bg-slate-900/60 px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider">
              Recipients ({batch.results.length})
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {batch.results.map((r, i) => (
                    <tr key={i} className="border-t border-slate-800/30">
                      <td className="px-3 py-1.5">
                        {r.status === "sent" ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={10} /></span> : <span className="inline-flex items-center gap-1 text-xs text-red-400"><X size={10} /></span>}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-violet-300">{r.email}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-400 hidden md:table-cell">{r.name || "—"}</td>
                      <td className="px-3 py-1.5 text-[10px] text-red-400/70 hidden md:table-cell">{r.error || ""}</td>
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
}

interface UserCardProps {
  user: User;
  batchCount: number;
  currentAdminEmail: string;
  onResetPassword: () => void;
  onDelete: () => void;
  onPromote: () => void;
  onDemote: () => void;
  isResetting: boolean;
  newPassword: string;
  setNewPassword: (p: string) => void;
  onConfirmReset: () => void;
  onCancelReset: () => void;
}

function UserCard({ user, batchCount, currentAdminEmail, onResetPassword, onDelete, onPromote, onDemote, isResetting, newPassword, setNewPassword, onConfirmReset, onCancelReset }: UserCardProps) {
  const isAdmin = user.role === "admin";
  const isSelf = user.email.toLowerCase() === currentAdminEmail.toLowerCase();
  const isPrimaryAdmin = user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
  const canModify = !isSelf && !isPrimaryAdmin;

  return (
    <div className={`glass-card !p-0 overflow-hidden ${isAdmin ? "!border-amber-500/30" : ""}`}>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-white ${
          isAdmin ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20" : "bg-gradient-to-br from-violet-500 to-indigo-500"
        }`}>
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white truncate">{user.name || "(no name)"}</p>
            {isAdmin && <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown size={9} />Admin</span>}
            {isSelf && <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">You</span>}
            {isPrimaryAdmin && <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">Primary</span>}
          </div>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><Calendar size={9} />Joined {timeAgo(user.createdAt)}</span>
            <span className="flex items-center gap-1"><Clock size={9} />Last: {timeAgo(user.lastLoginAt)}</span>
            <span className="flex items-center gap-1"><Send size={9} />{batchCount} batches</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onResetPassword} className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20" title="Reset password">
            <KeyRound size={14} />
          </button>
          {canModify && !isAdmin && (
            <button onClick={onPromote} className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20" title="Promote to admin">
              <Shield size={14} />
            </button>
          )}
          {canModify && isAdmin && (
            <button onClick={onDemote} className="p-2 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500/20" title="Demote to user">
              <ShieldOff size={14} />
            </button>
          )}
          {canModify && (
            <button onClick={onDelete} className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" title="Delete user">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {isResetting && (
        <div className="px-4 pb-4 border-t border-slate-800/50 pt-4">
          <p className="text-xs font-semibold text-violet-300 mb-2">Set new password for {user.email}</p>
          <div className="flex gap-2">
            <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" className="input-field flex-1 !text-xs" autoFocus />
            <button onClick={onConfirmReset} disabled={newPassword.length < 6} className="px-3 py-2 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/40 text-xs font-semibold hover:bg-violet-500/30 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={onCancelReset} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs hover:text-slate-200">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-2 border border-slate-700/30">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-slate-200 mt-0.5 truncate">{value}</p>
    </div>
  );
}
