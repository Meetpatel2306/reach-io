"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, Shield, ShieldOff, Trash2, Calendar, Mail, User, Headphones, Music, ArrowDownAZ, ArrowDown01, ArrowDown10, RefreshCw, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { auth, type UserProfile } from "@/lib/auth";

type SortKey = "name" | "email" | "createdAt" | "lastLogin" | "totalPlays" | "totalListenSeconds";
type SortDir = "asc" | "desc";

function fmtRel(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function fmtDuration(sec: number): string {
  if (!sec || !isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "user">("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tick, setTick] = useState(0);

  function reload() { setProfiles(auth.list()); }

  useEffect(() => { reload(); }, [tick]);

  // Gate
  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (!user.isAdmin) { router.replace("/"); }
  }, [user, router]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let arr = profiles.filter((p) => {
      if (filterRole === "admin" && !p.isAdmin) return false;
      if (filterRole === "user" && p.isAdmin) return false;
      if (q && !(p.email.includes(q) || p.displayName.toLowerCase().includes(q))) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      const av: any = (a as any)[sortKey];
      const bv: any = (b as any)[sortKey];
      const an = typeof av === "number" ? av : String(av || "").toLowerCase();
      const bn = typeof bv === "number" ? bv : String(bv || "").toLowerCase();
      if (an < bn) return sortDir === "asc" ? -1 : 1;
      if (an > bn) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [profiles, query, filterRole, sortKey, sortDir]);

  function flipSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  function deleteProfile(id: string, name: string) {
    if (!confirm(`Delete profile "${name}"? Their playlists/likes/history stay on this device but the account will be removed.`)) return;
    auth.remove(id);
    setTick((t) => t + 1);
    refresh();
    toast(`Deleted ${name}`, "info");
  }

  function toggleAdmin(p: UserProfile) {
    if (p.isAdmin) auth.demoteAdmin(p.id);
    else auth.promoteAdmin(p.id);
    setTick((t) => t + 1);
    toast(p.isAdmin ? `${p.displayName} is no longer admin` : `${p.displayName} is now admin`, "success");
  }

  if (!user || !user.isAdmin) {
    return <div className="p-8 text-center text-secondary">Loading…</div>;
  }

  // Aggregate stats
  const totalUsers = profiles.length;
  const totalAdmins = profiles.filter((p) => p.isAdmin).length;
  const activeWeek = profiles.filter((p) => Date.now() - p.lastLogin < 7 * 86400_000).length;
  const totalPlays = profiles.reduce((s, p) => s + (p.totalPlays || 0), 0);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest">
            <Crown className="w-4 h-4" /> Admin Dashboard
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">All Profiles</h1>
        </div>
        <button onClick={() => setTick((t) => t + 1)} className="text-sm text-secondary hover:text-white px-3 py-1.5 rounded-lg bg-card hover:bg-card-hover flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={User} label="Total profiles" value={totalUsers.toString()} accent />
        <Stat icon={Shield} label="Admins" value={totalAdmins.toString()} />
        <Stat icon={Calendar} label="Active this week" value={activeWeek.toString()} />
        <Stat icon={Headphones} label="Total plays" value={totalPlays.toLocaleString()} />
      </section>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or email"
            className="w-full bg-card rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)} className="bg-card rounded-lg px-3 py-2 text-sm outline-none">
          <option value="all">All roles</option>
          <option value="admin">Admins only</option>
          <option value="user">Users only</option>
        </select>
        <div className="flex bg-card rounded-lg overflow-hidden text-xs">
          {[
            { k: "createdAt" as const, l: "Joined" },
            { k: "lastLogin" as const, l: "Active" },
            { k: "name" as const, l: "Name" },
            { k: "email" as const, l: "Email" },
            { k: "totalPlays" as const, l: "Plays" },
            { k: "totalListenSeconds" as const, l: "Time" },
          ].map((s) => (
            <button key={s.k} onClick={() => flipSort(s.k)}
              className={`px-3 py-2 flex items-center gap-1 ${sortKey === s.k ? "bg-accent/20 text-accent" : "text-secondary hover:text-white"}`}>
              {s.l}
              {sortKey === s.k && (typeof (profiles[0] as any)?.[s.k] === "number"
                ? (sortDir === "asc" ? <ArrowDown01 className="w-3 h-3" /> : <ArrowDown10 className="w-3 h-3" />)
                : <ArrowDownAZ className={`w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} />
              )}
            </button>
          ))}
        </div>
        <span className="text-xs text-secondary ml-auto">{filtered.length} of {totalUsers}</span>
      </div>

      {/* Profile cards */}
      <section className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-secondary py-12">No profiles match your filters.</div>
        ) : filtered.map((p) => (
          <div key={p.id} className={`bg-card rounded-xl p-4 flex items-center gap-4 ${p.id === user.id ? "ring-1 ring-accent" : ""}`}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/40 to-accent/10 flex items-center justify-center text-2xl flex-shrink-0">
              {p.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{p.displayName}</span>
                {p.isAdmin && <span className="text-[10px] uppercase tracking-wider bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Shield className="w-2.5 h-2.5" />Admin</span>}
                {p.id === user.id && <span className="text-[10px] uppercase tracking-wider bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">You</span>}
              </div>
              <div className="text-xs text-secondary line-clamp-1 mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> {p.email}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-secondary flex-wrap">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {fmtRel(p.createdAt)}</span>
                <span>•</span>
                <span>Active {fmtRel(p.lastLogin)}</span>
                {p.totalPlays != null && <><span>•</span><span className="flex items-center gap-1"><Headphones className="w-3 h-3" />{p.totalPlays} plays</span></>}
                {p.totalListenSeconds != null && <><span>•</span><span><Music className="w-3 h-3 inline" /> {fmtDuration(p.totalListenSeconds)}</span></>}
                {p.topArtist && <><span>•</span><span>Top: {p.topArtist}</span></>}
                {p.topLanguage && <><span>•</span><span className="capitalize">{p.topLanguage}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => toggleAdmin(p)} disabled={p.id === user.id && p.isAdmin && totalAdmins === 1}
                className="p-2 text-secondary hover:text-white hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title={p.isAdmin ? "Demote to user" : "Promote to admin"}>
                {p.isAdmin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteProfile(p.id, p.displayName)} disabled={p.id === user.id}
                className="p-2 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Delete profile">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </section>

      <p className="text-xs text-secondary/60 mt-8 max-w-2xl">
        Profiles are stored in this browser's localStorage. Listening data per profile is mirrored at logout.
        Anyone with access to this device can see all profiles — this is a personalization layer, not real authentication.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-card rounded-xl p-4 ${accent ? "ring-1 ring-accent/40" : ""}`}>
      <Icon className="w-4 h-4 text-accent mb-2" />
      <div className="text-xs text-secondary">{label}</div>
      <div className="text-2xl font-extrabold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
