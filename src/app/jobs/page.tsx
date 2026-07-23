"use client";

import { useEffect, useState } from "react";
import {
  Search, Loader2, Briefcase, ExternalLink, Trash2, Pencil, Check, X,
  Globe, Mail, Phone, ChevronDown, ChevronUp, Radar, Sparkles, Copy, ClipboardCheck,
} from "lucide-react";
import type { JobLead, LeadStatus } from "@/lib/jobLeads";

// Job Finder — a fully separate module from the outreach/mail side.
// AI-grounded Google search (Gemini primary, Groq backup) → persistent,
// editable leads table. Teal accent to visually separate it from mail (violet).

const STATUS_OPTIONS: { value: LeadStatus; label: string; cls: string }[] = [
  { value: "new", label: "New", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { value: "applied", label: "Applied", cls: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  { value: "interview", label: "Interview", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  { value: "rejected", label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
];

// One lead as clean, pasteable text — used by row copy and copy-all.
function formatLead(l: JobLead): string {
  const lines = [
    `Company: ${l.company}`,
    `Role: ${l.role}`,
    l.experience ? `Experience: ${l.experience}` : "",
    l.package ? `Package: ${l.package}` : "",
    l.location ? `Location: ${l.location}` : "",
    l.postedWhen ? `Posted: ${l.postedWhen}` : "",
    l.jd ? `About: ${l.jd}` : "",
    `Apply: ${l.applyLink}`,
    l.careerPage ? `Career page: ${l.careerPage}` : "",
    l.contactEmail ? `Email: ${l.contactEmail}` : "",
    l.contactPhone ? `Phone: ${l.contactPhone}` : "",
    l.source ? `Source: ${l.source}` : "",
    `Status: ${l.status}`,
    l.notes ? `Notes: ${l.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older/insecure contexts: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

const EDIT_FIELDS: { key: keyof JobLead; label: string; wide?: boolean }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "experience", label: "Experience asked" },
  { key: "package", label: "Package" },
  { key: "location", label: "Location" },
  { key: "postedWhen", label: "Posted" },
  { key: "applyLink", label: "Apply link", wide: true },
  { key: "careerPage", label: "Career page", wide: true },
  { key: "contactEmail", label: "Contact email" },
  { key: "contactPhone", label: "Phone" },
  { key: "jd", label: "Job description", wide: true },
  { key: "notes", label: "My notes", wide: true },
];

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("India");
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [expandedId, setExpandedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Partial<JobLead>>({});
  const [contactBusyId, setContactBusyId] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  async function copyLead(l: JobLead) {
    if (await copyText(formatLead(l))) {
      setCopiedId(l.id);
      setTimeout(() => setCopiedId(""), 1500);
    }
  }

  async function copyAllVisible(list: JobLead[]) {
    if (await copyText(list.map(formatLead).join("\n\n———\n\n"))) {
      setCopiedId("__all__");
      setTimeout(() => setCopiedId(""), 1500);
    }
  }

  useEffect(() => {
    fetch("/api/job-search", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.leads)) setLeads(d.leads); })
      .catch(() => {})
      .finally(() => setLoaded(true));
    const savedQ = localStorage.getItem("jobfinder-query");
    if (savedQ) setQuery(savedQ);
  }, []);

  async function runSearch() {
    if (query.trim().length < 3 || searching) return;
    setSearching(true); setError(""); setMsg("");
    localStorage.setItem("jobfinder-query", query.trim());
    try {
      const res = await fetch("/api/job-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setLeads(data.leads || []);
      setMsg(`Found ${data.found} · ${data.added} new added${data.skipped ? ` · ${data.skipped} already in your table` : ""} — via ${data.provider === "groq" ? "Groq (backup)" : "Gemini + Google"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  async function patchLead(id: string, patch: Partial<JobLead>) {
    const res = await fetch(`/api/job-search/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok && data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
    }
  }

  async function removeLead(id: string) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/job-search/leads/${id}`, { method: "DELETE" });
  }

  async function clearAll() {
    setConfirmClear(false);
    setLeads([]);
    await fetch("/api/job-search", { method: "DELETE" });
  }

  async function findContactFor(id: string) {
    setContactBusyId(id); setError(""); setMsg("");
    try {
      const res = await fetch("/api/job-search/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Contact search failed");
      if (data.lead) setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
      setMsg(data.message || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setContactBusyId("");
    }
  }

  function startEdit(l: JobLead) {
    setEditingId(l.id);
    setExpandedId(l.id);
    setDraft({ ...l });
  }

  async function saveEdit() {
    if (!editingId) return;
    await patchLead(editingId, draft);
    setEditingId(""); setDraft({});
  }

  const visible = statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
          <Briefcase size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Job Finder</h1>
          <p className="text-slate-500 text-xs">Live Google-grounded search · your saved leads table · fully separate from Outreach</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-400/60" />
            <input
              className="input-field !pl-9"
              placeholder='e.g. "python developer 1 year experience" or "AI engineer fresher"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            />
          </div>
          <select className="input-field sm:!w-44" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="India">India</option>
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="Remote">Remote</option>
            <option value="India or Remote">India or Remote</option>
            <option value="">Anywhere</option>
          </select>
          <button
            onClick={runSearch}
            disabled={searching || query.trim().length < 3}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
            {searching ? "Searching Google..." : "Search Jobs"}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <Sparkles size={11} className="text-teal-400" />
          The AI runs real Google searches and returns only postings with a direct link. New finds are added to your table below; duplicates are skipped.
        </p>
        {msg && <p className="text-xs text-teal-300 mt-2">{msg}</p>}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* Table header row: filter + clear */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "new", "applied", "interview", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                statusFilter === s
                  ? "bg-teal-500/20 text-teal-200 border-teal-500/40"
                  : "bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-800"
              }`}
            >
              {s === "all" ? `All (${leads.length})` : `${s[0].toUpperCase()}${s.slice(1)} (${leads.filter((l) => l.status === s).length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
        {visible.length > 0 && (
          <button
            onClick={() => copyAllVisible(visible)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-teal-300 border border-teal-500/25 bg-teal-500/5 hover:bg-teal-500/15 transition"
            title="Copy every visible job as text"
          >
            {copiedId === "__all__" ? <ClipboardCheck size={12} /> : <Copy size={12} />}
            {copiedId === "__all__" ? "Copied!" : `Copy all (${visible.length})`}
          </button>
        )}
        {leads.length > 0 && (
          confirmClear ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Delete all {leads.length}?</span>
              <button onClick={clearAll} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30">Yes, clear</button>
              <button onClick={() => setConfirmClear(false)} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 transition">
              <Trash2 size={12} /> Clear all
            </button>
          )
        )}
        </div>
      </div>

      {/* Leads table */}
      {!loaded ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading your saved leads…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-10 text-center">
          <Radar size={26} className="text-teal-400 mx-auto mb-3" />
          <p className="text-white font-semibold">{leads.length === 0 ? "No saved jobs yet" : "Nothing with this status"}</p>
          {leads.length === 0 && (
            <p className="text-sm text-slate-400 mt-1">Type your role above — e.g. &ldquo;python developer 1 year experience&rdquo; — and hit Search Jobs.</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-800/60 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Company / Role</th>
                  <th className="px-3 py-3">Experience</th>
                  <th className="px-3 py-3">Package</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      Contact
                      {visible.some((l) => l.contactEmail) && (
                        <button
                          onClick={async () => {
                            const emails = [...new Set(visible.map((l) => l.contactEmail).filter(Boolean))];
                            if (await copyText(emails.join("\n"))) {
                              setCopiedId("__emails__");
                              setTimeout(() => setCopiedId(""), 1500);
                            }
                          }}
                          title="Copy all emails from the listed jobs"
                          className={`p-1 rounded border transition normal-case ${copiedId === "__emails__" ? "border-teal-500/50 text-teal-300" : "border-slate-700 text-slate-500 hover:text-teal-300 hover:border-teal-500/40"}`}
                        >
                          {copiedId === "__emails__" ? <ClipboardCheck size={11} /> : <Copy size={11} />}
                        </button>
                      )}
                    </span>
                  </th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visible.map((l) => (
                  <JobRow
                    key={l.id}
                    lead={l}
                    expanded={expandedId === l.id}
                    editing={editingId === l.id}
                    draft={draft}
                    setDraft={setDraft}
                    contactBusy={contactBusyId === l.id}
                    copied={copiedId === l.id}
                    onCopy={() => copyLead(l)}
                    onToggle={() => setExpandedId(expandedId === l.id ? "" : l.id)}
                    onEdit={() => startEdit(l)}
                    onSave={saveEdit}
                    onCancelEdit={() => { setEditingId(""); setDraft({}); }}
                    onDelete={() => removeLead(l.id)}
                    onStatus={(s) => patchLead(l.id, { status: s })}
                    onFindContact={() => findContactFor(l.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function JobRow({
  lead: l, expanded, editing, draft, setDraft, contactBusy, copied,
  onToggle, onEdit, onSave, onCancelEdit, onDelete, onStatus, onFindContact, onCopy,
}: {
  lead: JobLead;
  expanded: boolean;
  editing: boolean;
  draft: Partial<JobLead>;
  setDraft: (d: Partial<JobLead>) => void;
  contactBusy: boolean;
  copied: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onStatus: (s: LeadStatus) => void;
  onFindContact: () => void;
  onCopy: () => void;
}) {
  const status = STATUS_OPTIONS.find((s) => s.value === l.status) || STATUS_OPTIONS[0];
  return (
    <>
      <tr
        className="hover:bg-slate-800/30 transition cursor-pointer"
        onClick={(e) => {
          // The whole row toggles the detail view — except clicks on real
          // controls (links, buttons, selects, inputs) inside it.
          if ((e.target as HTMLElement).closest("a,button,select,input,textarea")) return;
          onToggle();
        }}
      >
        <td className="px-4 py-3">
          <p className="font-semibold text-white flex items-center gap-1.5">
            {l.company}
            {expanded ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
          </p>
          <p className="text-xs text-slate-400">{l.role}{l.postedWhen ? ` · ${l.postedWhen}` : ""}</p>
        </td>
        <td className="px-3 py-3 text-slate-300 text-xs">{l.experience || "—"}</td>
        <td className="px-3 py-3 text-slate-300 text-xs">{l.package || "—"}</td>
        <td className="px-3 py-3 text-slate-300 text-xs">{l.location || "—"}</td>
        <td className="px-3 py-3 text-xs">
          {l.contactEmail || l.contactPhone ? (
            <button
              onClick={() => copyText(l.contactEmail || l.contactPhone)}
              title="Click to copy"
              className="text-teal-300 flex items-center gap-1 hover:text-teal-200 hover:underline"
            >
              {l.contactEmail ? <Mail size={11} /> : <Phone size={11} />}
              {l.contactEmail || l.contactPhone}
            </button>
          ) : (
            <span className="text-slate-600">empty</span>
          )}
        </td>
        <td className="px-3 py-3">
          <select
            value={l.status}
            onChange={(e) => onStatus(e.target.value as LeadStatus)}
            className={`text-xs rounded-lg border px-2 py-1 bg-slate-900/60 ${status.cls}`}
          >
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onCopy} title="Copy this job as text"
              className={`p-1.5 rounded-lg border transition ${copied ? "border-teal-500/50 text-teal-300" : "border-slate-700 text-slate-400 hover:text-teal-300 hover:border-teal-500/40"}`}
            >
              {copied ? <ClipboardCheck size={14} /> : <Copy size={14} />}
            </button>
            <a
              href={l.applyLink} target="_blank" rel="noopener noreferrer" title="Open posting"
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-teal-300 hover:border-teal-500/40 transition"
            >
              <ExternalLink size={14} />
            </a>
            {l.careerPage && (
              <a
                href={l.careerPage} target="_blank" rel="noopener noreferrer" title="Career page"
                className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-teal-300 hover:border-teal-500/40 transition"
              >
                <Globe size={14} />
              </a>
            )}
            <button
              onClick={onFindContact} disabled={contactBusy} title="AI: find career page + contact email/phone"
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-teal-300 hover:border-teal-500/40 transition disabled:opacity-50"
            >
              {contactBusy ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
            </button>
            <button
              onClick={onEdit} title="Edit all fields"
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-violet-300 hover:border-violet-500/40 transition"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete} title="Delete row"
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>

      {(expanded || editing) && (
        <tr className="bg-slate-900/40">
          <td colSpan={7} className="px-4 py-4">
            {editing ? (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EDIT_FIELDS.map((f) => (
                    <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">{f.label}</label>
                      {f.key === "jd" || f.key === "notes" ? (
                        <textarea
                          className="input-field" rows={3}
                          value={(draft[f.key] as string) || ""}
                          onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        />
                      ) : (
                        <input
                          className="input-field"
                          value={(draft[f.key] as string) || ""}
                          onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={onSave} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition">
                    <Check size={14} /> Save
                  </button>
                  <button onClick={onCancelEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm hover:bg-slate-700 transition">
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-300 space-y-2">
                {l.jd && <p className="text-slate-300">{l.jd}</p>}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
                  {l.careerPage && <span className="flex items-center gap-1"><Globe size={11} /> <a className="text-teal-300 hover:underline" href={l.careerPage} target="_blank" rel="noopener noreferrer">{l.careerPage}</a></span>}
                  {l.contactEmail && <span className="flex items-center gap-1"><Mail size={11} /> {l.contactEmail}</span>}
                  {l.contactPhone && <span className="flex items-center gap-1"><Phone size={11} /> {l.contactPhone}</span>}
                  {l.source && <span>Source: {l.source}</span>}
                  <span>Found via &ldquo;{l.query}&rdquo; · {new Date(l.createdAt).toLocaleDateString()}</span>
                </div>
                {l.notes && <p className="text-xs text-amber-200/80">📝 {l.notes}</p>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
