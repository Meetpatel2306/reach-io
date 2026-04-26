"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Shield, Users, Search, Trash2, KeyRound, Crown, Calendar,
  Mail, Loader2, Check, X, AlertOctagon, Copy, BarChart3, TrendingUp,
  UserPlus, Clock, Activity, Filter, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";

interface User {
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt?: string;
  sessionMaxAgeMs?: number;
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

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "admin" | "user">("all");
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.json());
        if (me.user?.role !== "admin") {
          router.push("/login");
          return;
        }
        setAuthorized(true);
        await loadUsers();
      } catch {
        router.push("/login");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (data.users) setUsers(data.users);
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
    if (res.ok) {
      setResettingEmail(null);
      setNewPassword("");
    }
  };

  const handleDeleteUser = async (email: string) => {
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setActionMsg(data.error || `Deleted ${email}`);
    if (res.ok) {
      setConfirmDelete(null);
      await loadUsers();
    }
  };

  // Filter + search
  const filtered = useMemo(() => {
    let arr = users;
    if (filter !== "all") arr = arr.filter((u) => u.role === filter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
    }
    return arr;
  }, [users, filter, search]);

  // Stats
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const newThisWeek = users.filter((u) => {
      const created = new Date(u.createdAt).getTime();
      return Date.now() - created < 7 * 24 * 60 * 60 * 1000;
    }).length;
    const activeToday = users.filter((u) => {
      if (!u.lastLoginAt) return false;
      const last = new Date(u.lastLoginAt).getTime();
      return Date.now() - last < 24 * 60 * 60 * 1000;
    }).length;
    return { total, admins, newThisWeek, activeToday };
  }, [users]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-red-500/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-900/60 backdrop-blur text-slate-400 hover:text-amber-300 hover:border-amber-500/30 transition-all">
              <ArrowLeft size={18} />
            </Link>
            <span className="text-xs text-amber-400/80 uppercase tracking-widest flex items-center gap-1.5">
              <Crown size={12} />Admin Console
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Shield size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm text-slate-400">Manage users, reset passwords, view stats</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionMsg.includes("Deleted") || actionMsg.includes("reset") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
          {actionMsg}
          <button onClick={() => setActionMsg("")} className="float-right text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Users, label: "Total Users", value: stats.total, color: "text-violet-300", gradient: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/30" },
          { icon: Crown, label: "Admins", value: stats.admins, color: "text-amber-300", gradient: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/30" },
          { icon: UserPlus, label: "New (7d)", value: stats.newThisWeek, color: "text-emerald-300", gradient: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30" },
          { icon: Activity, label: "Active Today", value: stats.activeToday, color: "text-blue-300", gradient: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/30" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`bg-gradient-to-br ${s.gradient} backdrop-blur rounded-2xl p-4 border ${s.border}`}>
              <Icon size={18} className={`${s.color} mb-2`} />
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input-field pl-10"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          {(["all", "admin", "user"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all capitalize ${
                filter === f
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-200"
              }`}
            >
              {f}{f !== "all" && "s"}
            </button>
          ))}
          <button onClick={loadUsers} className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-violet-300" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="glass-card text-center py-16">
          <Users size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400">{search ? "No users match your search." : "No users yet."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <UserCard
              key={user.email}
              user={user}
              onResetPassword={() => { setResettingEmail(user.email); setNewPassword(""); }}
              onDelete={() => setConfirmDelete(user.email)}
              isResetting={resettingEmail === user.email}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              onConfirmReset={() => handleResetPassword(user.email)}
              onCancelReset={() => { setResettingEmail(null); setNewPassword(""); }}
            />
          ))}
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
            <p className="text-sm text-slate-400 mb-1">This will permanently delete:</p>
            <p className="text-sm text-amber-300 font-mono mb-6">{confirmDelete}</p>
            <p className="text-xs text-red-400/60 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm font-semibold hover:bg-slate-700">Cancel</button>
              <button onClick={() => handleDeleteUser(confirmDelete)} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-semibold shadow-lg shadow-red-500/20">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface UserCardProps {
  user: User;
  onResetPassword: () => void;
  onDelete: () => void;
  isResetting: boolean;
  newPassword: string;
  setNewPassword: (p: string) => void;
  onConfirmReset: () => void;
  onCancelReset: () => void;
}

function UserCard({ user, onResetPassword, onDelete, isResetting, newPassword, setNewPassword, onConfirmReset, onCancelReset }: UserCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isAdmin = user.role === "admin";

  return (
    <div className={`glass-card !p-0 overflow-hidden ${isAdmin ? "!border-amber-500/30" : ""}`}>
      <div className="p-4 flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-white ${
          isAdmin ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20" : "bg-gradient-to-br from-violet-500 to-indigo-500"
        }`}>
          {user.name.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white truncate">{user.name || "(no name)"}</p>
            {isAdmin && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Crown size={9} />Admin
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><Calendar size={9} />Joined {timeAgo(user.createdAt)}</span>
            <span className="flex items-center gap-1"><Clock size={9} />Last login: {timeAgo(user.lastLoginAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button onClick={onResetPassword} className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20" title="Reset password">
            <KeyRound size={14} />
          </button>
          {!isAdmin && (
            <button onClick={onDelete} className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" title="Delete user">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-violet-300">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Reset password inline */}
      {isResetting && (
        <div className="px-4 pb-4 border-t border-slate-800/50 pt-4">
          <p className="text-xs font-semibold text-violet-300 mb-2">Set new password for {user.email}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="input-field flex-1 !text-xs"
              autoFocus
            />
            <button onClick={onConfirmReset} disabled={newPassword.length < 6} className="px-3 py-2 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/40 text-xs font-semibold hover:bg-violet-500/30 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={onCancelReset} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs hover:text-slate-200">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/50 pt-4 grid grid-cols-2 gap-3">
          <Detail label="Created" value={`${formatDate(user.createdAt)} ${formatTime(user.createdAt)}`} />
          <Detail label="Last Login" value={user.lastLoginAt ? `${formatDate(user.lastLoginAt)} ${formatTime(user.lastLoginAt)}` : "Never"} />
          <Detail label="Role" value={user.role} />
          <Detail label="Session Length" value={user.sessionMaxAgeMs ? `${Math.round(user.sessionMaxAgeMs / 3600000)}h` : "Default (24h)"} />
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-2 border border-slate-700/30">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-slate-200 mt-0.5">{value}</p>
    </div>
  );
}
