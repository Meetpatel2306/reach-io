"use client";
import { useEffect, useMemo, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Search as SearchIcon, Shield, ShieldOff, Trash2, Calendar, Mail, User, Headphones,
  Music, ArrowDownAZ, ArrowDown01, ArrowDown10, RefreshCw, Crown, Download,
  CheckSquare, Square, X, ChevronLeft, ChevronRight, Eye, Users,
} from "lucide-react";
import type { AuthAdapter, ToastFn, UserProfile } from "./types";
import { StatCard, FilterBar, FilterRow, PillTabs, EmptyState } from "./primitives";
import { fmtRel, fmtDuration, profilesToCsv, downloadCsv } from "./helpers";

type SortKey = "displayName" | "email" | "createdAt" | "lastLogin" | "totalPlays" | "totalListenSeconds";
type SortDir = "asc" | "desc";

/**
 * A custom tab the consuming app injects beside the built-in "Profiles" tab.
 * The kit owns the tab strip; you own the content. `count` shows a numeric
 * badge on the tab pill (e.g. "Emails 142").
 */
export interface AdminTab {
  id: string;
  label: string;
  icon?: any;
  count?: number;
  render: () => ReactNode;
}

export interface AdminPageProps {
  adapter: AuthAdapter;
  toast?: ToastFn;
  /** Inline chips shown in each profile row (small strip below the email). */
  extraColumns?: { label: string; render: (p: UserProfile) => ReactNode }[];
  /** Extra columns added to the CSV export. */
  csvExtras?: { label: string; render: (p: UserProfile) => string }[];
  /** Custom row actions in addition to promote/demote/delete. */
  extraActions?: { icon: any; label: string; onClick: (p: UserProfile) => void; danger?: boolean }[];
  /** Detail panel rendered inside the profile-detail modal. */
  detailPanel?: (p: UserProfile) => ReactNode;
  /** Page size for the pagination footer. Default 25. */
  pageSize?: number;
  /** Where to send non-admin users. Default "/" */
  notAdminRedirect?: string;
  /** Extra tabs alongside the built-in "Profiles" tab. */
  tabs?: AdminTab[];
  /** Initial active tab. Default "profiles". */
  defaultTab?: string;
  /** Title shown next to the Crown icon. */
  title?: string;
}

export function AdminPage({
  adapter, toast, extraColumns, csvExtras, extraActions, detailPanel,
  pageSize = 25, notAdminRedirect = "/", tabs = [], defaultTab = "profiles", title = "Admin Dashboard",
}: AdminPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Filters (Profiles tab)
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "user">("all");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [activeSinceDays, setActiveSinceDays] = useState<"any" | "1" | "7" | "30" | "90">("any");
  const [playsMin, setPlaysMin] = useState("");
  const [playsMax, setPlaysMax] = useState("");
  const [topLanguage, setTopLanguage] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Selection + paging + detail
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [detailFor, setDetailFor] = useState<UserProfile | null>(null);

  function refreshProfiles() {
    Promise.resolve(adapter.list()).then(setProfiles);
  }
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(adapter.current()).then((u) => {
      if (cancelled) return;
      setUser(u);
      if (!u) { router.replace("/login"); return; }
      if (!u.isAdmin) { router.replace(notAdminRedirect); }
    });
    refreshProfiles();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, tick]);

  // Universe of languages for the language filter dropdown
  const languages = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => p.topLanguage && set.add(p.topLanguage.toLowerCase()));
    return Array.from(set).sort();
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const fromTs = joinedFrom ? new Date(joinedFrom).getTime() : 0;
    const toTs = joinedTo ? new Date(joinedTo).getTime() + 86400_000 : Infinity;
    const activeCutoff = activeSinceDays === "any" ? 0 : Date.now() - parseInt(activeSinceDays, 10) * 86400_000;
    const minP = playsMin ? parseInt(playsMin, 10) : -Infinity;
    const maxP = playsMax ? parseInt(playsMax, 10) : Infinity;
    let arr = profiles.filter((p) => {
      if (filterRole === "admin" && !p.isAdmin) return false;
      if (filterRole === "user" && p.isAdmin) return false;
      if (q && !(p.email.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q) || (p.topArtist || "").toLowerCase().includes(q))) return false;
      if (p.createdAt < fromTs || p.createdAt > toTs) return false;
      if (p.lastLogin < activeCutoff) return false;
      const pl = p.totalPlays || 0;
      if (pl < minP || pl > maxP) return false;
      if (topLanguage && (p.topLanguage || "").toLowerCase() !== topLanguage) return false;
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
  }, [profiles, query, filterRole, joinedFrom, joinedTo, activeSinceDays, playsMin, playsMax, topLanguage, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [query, filterRole, joinedFrom, joinedTo, activeSinceDays, playsMin, playsMax, topLanguage, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function flipSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }
  function clearFilters() {
    setQuery(""); setFilterRole("all"); setJoinedFrom(""); setJoinedTo("");
    setActiveSinceDays("any"); setPlaysMin(""); setPlaysMax(""); setTopLanguage("");
  }
  function toggleSelectAll() {
    if (pageRows.every((p) => selected.has(p.id))) {
      const next = new Set(selected); pageRows.forEach((p) => next.delete(p.id)); setSelected(next);
    } else {
      const next = new Set(selected); pageRows.forEach((p) => next.add(p.id)); setSelected(next);
    }
  }
  function toggleOne(id: string) {
    const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); setSelected(next);
  }
  async function deleteProfile(id: string, name: string) {
    if (!confirm(`Delete profile "${name}"?`)) return;
    await adapter.remove(id);
    setTick((t) => t + 1);
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    toast?.(`Deleted ${name}`, "info");
  }
  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} selected profile${selected.size === 1 ? "" : "s"}?`)) return;
    for (const id of selected) {
      if (id === user?.id) continue;
      await adapter.remove(id);
    }
    setSelected(new Set()); setTick((t) => t + 1);
    toast?.(`Deleted ${selected.size} profiles`, "info");
  }
  async function bulkPromote() {
    for (const id of selected) await adapter.promoteAdmin(id);
    setTick((t) => t + 1); toast?.(`Promoted ${selected.size} to admin`, "success");
  }
  async function bulkDemote() {
    for (const id of selected) { if (id === user?.id) continue; await adapter.demoteAdmin(id); }
    setTick((t) => t + 1); toast?.(`Demoted ${selected.size} to user`, "success");
  }
  async function toggleAdmin(p: UserProfile) {
    if (p.isAdmin) await adapter.demoteAdmin(p.id);
    else await adapter.promoteAdmin(p.id);
    setTick((t) => t + 1);
    toast?.(p.isAdmin ? `${p.displayName} is no longer admin` : `${p.displayName} is now admin`, "success");
  }
  function exportCsv() {
    downloadCsv(`profiles-${new Date().toISOString().slice(0, 10)}.csv`, profilesToCsv(filtered, csvExtras || []));
    toast?.(`Exported ${filtered.length} profiles`, "success");
  }

  if (!user || !user.isAdmin) return <div className="p-8 text-center text-secondary">Loading…</div>;

  const totalUsers = profiles.length;
  const totalAdmins = profiles.filter((p) => p.isAdmin).length;
  const activeWeek = profiles.filter((p) => Date.now() - p.lastLogin < 7 * 86400_000).length;
  const totalPlays = profiles.reduce((s, p) => s + (p.totalPlays || 0), 0);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id));

  // Tabs: built-in "Profiles" first, then any custom ones from the app
  const allTabs = [
    { id: "profiles", label: "Profiles", icon: Users, count: totalUsers },
    ...tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon, count: t.count })),
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest">
            <Crown className="w-4 h-4" /> {title}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
            {activeTab === "profiles" ? "All Profiles" : (tabs.find((t) => t.id === activeTab)?.label || "")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "profiles" && (
            <button onClick={exportCsv} className="text-sm text-secondary hover:text-white px-3 py-1.5 rounded-lg bg-card hover:bg-card-hover flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
          <button onClick={() => setTick((t) => t + 1)} className="text-sm text-secondary hover:text-white px-3 py-1.5 rounded-lg bg-card hover:bg-card-hover flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stat row stays on every tab so the admin always sees the high-level numbers */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={User} label="Total profiles" value={totalUsers.toString()} accent />
        <StatCard icon={Shield} label="Admins" value={totalAdmins.toString()} />
        <StatCard icon={Calendar} label="Active this week" value={activeWeek.toString()} />
        <StatCard icon={Headphones} label="Total plays" value={totalPlays.toLocaleString()} />
      </section>

      <PillTabs<string> tabs={allTabs} value={activeTab} onChange={setActiveTab} />

      {activeTab !== "profiles" ? (
        <>{tabs.find((t) => t.id === activeTab)?.render()}</>
      ) : (
        <>
          <FilterBar>
            <FilterRow>
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, top artist…"
                  className="w-full bg-bg rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)} className="bg-bg rounded-lg px-3 py-2 text-sm outline-none">
                <option value="all">All roles</option>
                <option value="admin">Admins only</option>
                <option value="user">Users only</option>
              </select>
              <select value={activeSinceDays} onChange={(e) => setActiveSinceDays(e.target.value as any)} className="bg-bg rounded-lg px-3 py-2 text-sm outline-none">
                <option value="any">Active anytime</option>
                <option value="1">Active in 24h</option>
                <option value="7">Active in 7d</option>
                <option value="30">Active in 30d</option>
                <option value="90">Active in 90d</option>
              </select>
              {languages.length > 0 && (
                <select value={topLanguage} onChange={(e) => setTopLanguage(e.target.value)} className="bg-bg rounded-lg px-3 py-2 text-sm outline-none capitalize">
                  <option value="">Any language</option>
                  {languages.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
              <button onClick={clearFilters} className="text-xs text-secondary hover:text-white px-3 py-2">Reset filters</button>
            </FilterRow>
            <FilterRow>
              <span className="text-xs text-secondary">Joined</span>
              <input type="date" value={joinedFrom} onChange={(e) => setJoinedFrom(e.target.value)} className="bg-bg rounded-lg px-3 py-1.5 text-xs outline-none" />
              <span className="text-xs text-secondary">to</span>
              <input type="date" value={joinedTo} onChange={(e) => setJoinedTo(e.target.value)} className="bg-bg rounded-lg px-3 py-1.5 text-xs outline-none" />
              <span className="text-xs text-secondary ml-3">Plays</span>
              <input type="number" value={playsMin} onChange={(e) => setPlaysMin(e.target.value)} placeholder="min" className="w-20 bg-bg rounded-lg px-3 py-1.5 text-xs outline-none" />
              <input type="number" value={playsMax} onChange={(e) => setPlaysMax(e.target.value)} placeholder="max" className="w-20 bg-bg rounded-lg px-3 py-1.5 text-xs outline-none" />
            </FilterRow>
            <div className="flex bg-bg rounded-lg overflow-hidden text-xs w-fit">
              {[
                { k: "createdAt" as const, l: "Joined" },
                { k: "lastLogin" as const, l: "Active" },
                { k: "displayName" as const, l: "Name" },
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
          </FilterBar>

          {selected.size > 0 && (
            <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{selected.size} selected</span>
              <div className="flex items-center gap-2">
                <button onClick={bulkPromote} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded">Promote</button>
                <button onClick={bulkDemote} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded">Demote</button>
                <button onClick={bulkDelete} className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded">Delete</button>
                <button onClick={() => setSelected(new Set())} className="text-secondary hover:text-white p-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-widest font-bold text-secondary border-b border-white/5 mb-2">
            <button onClick={toggleSelectAll} className="text-secondary hover:text-white">
              {allOnPageSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
            </button>
            <span>Profile</span>
            <span className="ml-auto">Actions</span>
          </div>

          <section className="space-y-2">
            {pageRows.length === 0 ? (
              <EmptyState icon={Users} title="No profiles match your filters" hint="Try resetting filters." />
            ) : pageRows.map((p) => (
              <div key={p.id} className={`bg-card rounded-xl p-4 flex items-center gap-4 ${p.id === user.id ? "ring-1 ring-accent" : ""} ${selected.has(p.id) ? "ring-1 ring-accent/60" : ""}`}>
                <button onClick={() => toggleOne(p.id)} className="text-secondary hover:text-white flex-shrink-0">
                  {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                </button>
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
                    {extraColumns?.map((c, i) => (
                      <span key={i} className="flex items-center gap-1"><span>•</span>{c.render(p)}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setDetailFor(p)} className="p-2 text-secondary hover:text-white hover:bg-white/5 rounded-lg" title="Details">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleAdmin(p)} disabled={p.id === user.id && p.isAdmin && totalAdmins === 1}
                    className="p-2 text-secondary hover:text-white hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                    title={p.isAdmin ? "Demote to user" : "Promote to admin"}>
                    {p.isAdmin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </button>
                  {extraActions?.map((a, i) => (
                    <button key={i} onClick={() => a.onClick(p)} className={`p-2 rounded-lg ${a.danger ? "text-secondary hover:text-red-400 hover:bg-red-500/10" : "text-secondary hover:text-white hover:bg-white/5"}`} title={a.label}>
                      <a.icon className="w-4 h-4" />
                    </button>
                  ))}
                  <button onClick={() => deleteProfile(p.id, p.displayName)} disabled={p.id === user.id}
                    className="p-2 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Delete profile">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </section>

          {filtered.length > pageSize && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-xs text-secondary">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 text-secondary hover:text-white disabled:opacity-30 rounded">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 tabular-nums">Page {page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 text-secondary hover:text-white disabled:opacity-30 rounded">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {detailFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDetailFor(null)}>
          <div className="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent/40 to-accent/10 flex items-center justify-center text-2xl">{detailFor.avatar}</div>
                <div>
                  <div className="font-extrabold text-xl">{detailFor.displayName}</div>
                  <div className="text-xs text-secondary">{detailFor.email}</div>
                </div>
              </div>
              <button onClick={() => setDetailFor(null)} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DetailField label="ID" value={detailFor.id} />
              <DetailField label="Role" value={detailFor.isAdmin ? "Admin" : "User"} />
              <DetailField label="Joined" value={new Date(detailFor.createdAt).toLocaleString()} />
              <DetailField label="Last login" value={new Date(detailFor.lastLogin).toLocaleString()} />
              <DetailField label="Total plays" value={(detailFor.totalPlays ?? 0).toLocaleString()} />
              <DetailField label="Listen time" value={fmtDuration(detailFor.totalListenSeconds || 0)} />
              <DetailField label="Top artist" value={detailFor.topArtist || "—"} />
              <DetailField label="Top song" value={detailFor.topSong || "—"} />
              <DetailField label="Top language" value={detailFor.topLanguage || "—"} />
            </dl>
            {detailPanel && <div className="mt-4 pt-4 border-t border-white/5">{detailPanel(detailFor)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-secondary mb-0.5">{label}</dt>
      <dd className="font-semibold text-sm break-words">{value}</dd>
    </div>
  );
}
