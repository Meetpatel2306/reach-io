"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Loader2, Briefcase, ExternalLink, Trash2, Pencil, Check, X,
  Globe, Mail, Phone, ChevronDown, ChevronUp, Radar, Sparkles, Copy, ClipboardCheck, SendHorizonal,
  FileText, Upload, KeyRound, Eye, EyeOff, Plus, MapPin, BellRing,
} from "lucide-react";
import type { JobLead, LeadStatus } from "@/lib/jobLeads";

interface JobResumeMeta {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

// Which roles a resume will be auto-picked for (mirrors the server's keyword rules).
function resumeKind(r: JobResumeMeta): "ai" | "python" | "any" {
  const tag = `${r.name} ${r.filename}`;
  if (/\bai\b|artificial|\bml\b|machine/i.test(tag)) return "ai";
  if (/python|backend|fastapi/i.test(tag)) return "python";
  return "any";
}

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
  // (6, 30) -> "6:30 AM"   (17, 0) -> "5:00 PM"
  function formatIstHour(h: number, m = 0): string {
    const suffix = h < 12 ? "AM" : "PM";
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("India");
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  // Which preset button is mid-search, so only that one shows a spinner.
  const [scopeBusy, setScopeBusy] = useState<"" | "gujarat" | "india">("");
  // Daily digest schedule. null until loaded, and stays null for non-admins —
  // the endpoint 401s for them, which doubles as the admin check.
  const [digest, setDigest] = useState<{ enabled: boolean; hourIst: number; minuteIst: number; lastSentDate: string } | null>(null);
  const [digestSaving, setDigestSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [expandedId, setExpandedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Partial<JobLead>>({});
  const [sendBusyId, setSendBusyId] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [jfResumes, setJfResumes] = useState<JobResumeMeta[]>([]);
  const [uploadingResumes, setUploadingResumes] = useState(false);
  const [resumeMsg, setResumeMsg] = useState("");
  // Per-account AI keys (encrypted server-side, synced across devices)
  const [aiKeys, setAiKeys] = useState<{ gemini: string[]; groq: string[] }>({ gemini: [], groq: [] });
  const [keysRevealed, setKeysRevealed] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [keyInput, setKeyInput] = useState<{ gemini: string; groq: string }>({ gemini: "", groq: "" });
  const [keyMsg, setKeyMsg] = useState("");
  // Errors were being shown through keyMsg, which renders teal — a rejected key
  // read as a success. They get their own red line now.
  const [keyErr, setKeyErr] = useState("");
  const [keyBusy, setKeyBusy] = useState<"" | "gemini" | "groq">("");
  const saveTimers = useRef<Partial<Record<"gemini" | "groq", ReturnType<typeof setTimeout>>>>({});

  // A pasted key is saved on its own once it looks complete — no Add click.
  // Deliberately shape-agnostic: providers change their key formats, and the
  // server verifies the key by actually calling the API, so guessing a prefix
  // here would only stop valid new-format keys from ever autosaving.
  function looksComplete(_provider: "gemini" | "groq", key: string): boolean {
    const k = key.trim();
    return k.length >= 20 && !/\s/.test(k);
  }

  function onKeyInput(provider: "gemini" | "groq", value: string) {
    setKeyInput((p) => ({ ...p, [provider]: value }));
    setKeyErr("");
    clearTimeout(saveTimers.current[provider]);
    // Debounced so it fires once when typing/pasting settles, not per keystroke.
    if (looksComplete(provider, value)) {
      saveTimers.current[provider] = setTimeout(() => addKey(provider), 800);
    }
  }

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
    fetch("/api/job-search/resumes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.resumes)) setJfResumes(d.resumes); })
      .catch(() => {});
    // Keys are stored encrypted server-side; the UI shows them decrypted to
    // their owner by default (a Hide toggle is available).
    fetch("/api/settings/ai-keys?reveal=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.keys) { setAiKeys(d.keys); setKeysRevealed(true); } })
      .catch(() => {});
    // 401 for non-admins — digest stays null and the card never renders.
    fetch("/api/settings/daily-digest", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.digest) setDigest(d.digest); })
      .catch(() => {});
  }, []);

  // Returns the keys so callers can confirm a save actually landed.
  async function refreshKeys(reveal: boolean): Promise<{ gemini: string[]; groq: string[] } | null> {
    const res = await fetch(`/api/settings/ai-keys${reveal ? "?reveal=1" : ""}`, { cache: "no-store" });
    if (!res.headers.get("content-type")?.includes("application/json")) return null;
    const data = await res.json();
    if (data.keys) { setAiKeys(data.keys); setKeysRevealed(reveal); return data.keys; }
    return null;
  }

  async function toggleRevealKeys() {
    await refreshKeys(!keysRevealed);
  }

  async function addKey(provider: "gemini" | "groq") {
    const key = keyInput[provider].trim();
    if (!key || keyBusy) return;
    clearTimeout(saveTimers.current[provider]);
    const before = aiKeys[provider].length;
    setKeyMsg(""); setKeyErr(""); setKeyBusy(provider);
    try {
      const res = await fetch("/api/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });

      // An expired session is redirected to the HTML login page, and parsing
      // that as JSON throws — which is why a failed save used to look like
      // nothing happening at all. Check the type before trusting the body.
      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          res.status === 401 || res.redirected
            ? "Your session expired — reload the page, sign in, and try again."
            : `Server returned ${res.status} instead of a result.`,
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the key");

      // Confirm it actually persisted rather than trusting the response — a key
      // that silently fails to store is the whole bug being fixed here.
      const after = await refreshKeys(true);
      if (!after || after[provider].length <= before) {
        throw new Error("The key was accepted but did not save. Reload and try again.");
      }

      setKeyInput((p) => ({ ...p, [provider]: "" }));
      setKeyMsg(`${provider === "gemini" ? "Gemini" : "Groq"} key saved to your account (encrypted) — it works on all your devices.`);
    } catch (e) {
      setKeyErr(e instanceof Error ? e.message : String(e));
    } finally {
      setKeyBusy("");
    }
  }

  async function deleteKey(provider: "gemini" | "groq", index: number) {
    await fetch("/api/settings/ai-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, index }),
    });
    await refreshKeys(true);
  }

  async function uploadResumes(files: FileList | null) {
    if (!files || !files.length) return;
    setUploadingResumes(true); setResumeMsg("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch("/api/job-search/resumes", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (Array.isArray(data.resumes)) setJfResumes(data.resumes);
      setResumeMsg(`Saved ${data.added?.length || 0} resume${(data.added?.length || 0) === 1 ? "" : "s"} — stored permanently.`);
    } catch (e) {
      setResumeMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingResumes(false);
    }
  }

  async function deleteResume(id: string) {
    const res = await fetch(`/api/job-search/resumes/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.resumes)) setJfResumes(data.resumes);
  }

  // scope set → one-click preset (no typed query needed); otherwise the typed box.
  async function runSearch(scope?: "gujarat" | "india") {
    if (searching) return;
    if (!scope && query.trim().length < 3) return;
    setSearching(true); setError(""); setMsg(""); setScopeBusy(scope || "");
    if (!scope) localStorage.setItem("jobfinder-query", query.trim());
    try {
      const res = await fetch("/api/job-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: scope
          ? JSON.stringify({ scope })
          : JSON.stringify({ query: query.trim(), location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setLeads(data.leads || []);
      const providerLabel =
        data.provider === "claude" ? "Claude (your local session)"
        : data.provider === "groq" ? "Groq (backup)"
        : "Gemini + Google";
      setMsg(`Found ${data.found} · ${data.added} new added${data.skipped ? ` · ${data.skipped} already in your table` : ""} — via ${providerLabel}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
      setScopeBusy("");
    }
  }

  async function saveDigest(patch: { enabled?: boolean; hourIst?: number; minuteIst?: number }) {
    setDigestSaving(true); setError("");
    try {
      const res = await fetch("/api/settings/daily-digest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the schedule");
      setDigest(data.digest);
      setMsg(
        data.digest.enabled
          ? `Daily digest set for ${formatIstHour(data.digest.hourIst, data.digest.minuteIst)} IST — you'll also get today's at that time.`
          : "Daily digest turned off.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDigestSaving(false);
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

  async function sendMailFor(id: string) {
    setSendBusyId(id); setError(""); setMsg("");
    try {
      const res = await fetch("/api/job-search/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      if (data.lead) setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
      setMsg(data.message || "Sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendBusyId("");
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
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto selectable">
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
            onClick={() => runSearch()}
            disabled={searching || query.trim().length < 3}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40"
          >
            {searching && !scopeBusy ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
            {searching && !scopeBusy ? "Searching Google..." : "Search Jobs"}
          </button>
        </div>

        {/* One-click presets — no typing. Each runs the curated 30-day,
            0-4 years, newest-first search for its region. */}
        <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-teal-500/15">
          <button
            onClick={() => runSearch("gujarat")}
            disabled={searching}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-400/30 text-violet-200 text-sm font-semibold hover:bg-violet-500/25 active:scale-[0.98] transition disabled:opacity-40"
          >
            {scopeBusy === "gujarat" ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
            {scopeBusy === "gujarat" ? "Searching Ahmedabad…" : "Find in Ahmedabad"}
          </button>
          <button
            onClick={() => runSearch("india")}
            disabled={searching}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-200 text-sm font-semibold hover:bg-indigo-500/25 active:scale-[0.98] transition disabled:opacity-40"
          >
            {scopeBusy === "india" ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
            {scopeBusy === "india" ? "Searching India…" : "Find across India"}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Presets need no typing: last 30 days, 0-4 years, newest first, senior/lead titles
          filtered out. Ahmedabad also covers Gandhinagar, GIFT City and Vadodara; India
          includes remote roles open to India.
        </p>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <Sparkles size={11} className="text-teal-400" />
          The AI runs real Google searches and returns only postings with a direct link. New finds are added to your table below; duplicates are skipped.
        </p>
        {msg && <p className="text-xs text-teal-300 mt-2">{msg}</p>}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* Daily digest schedule — admin only (endpoint 401s for everyone else) */}
      {digest && (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <BellRing size={15} className="text-violet-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Daily Ahmedabad digest</p>
                <p className="text-[11px] text-slate-500">
                  {digest.enabled
                    ? `Runs every day at ${formatIstHour(digest.hourIst, digest.minuteIst)} IST and emails you the new jobs. Changing the time applies from today.`
                    : "Turned off — no automatic search or email."}
                  {digest.lastSentDate ? ` Last sent ${digest.lastSentDate}.` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                className="input-field !w-36 !py-2"
                value={digest.hourIst * 60 + digest.minuteIst}
                disabled={digestSaving || !digest.enabled}
                onChange={(e) => {
                  const total = Number(e.target.value);
                  saveDigest({ hourIst: Math.floor(total / 60), minuteIst: total % 60 });
                }}
              >
                {Array.from({ length: 48 }, (_, i) => {
                  const h = Math.floor(i / 2);
                  const m = (i % 2) * 30;
                  return <option key={i} value={h * 60 + m}>{formatIstHour(h, m)} IST</option>;
                })}
              </select>

              <button
                role="switch"
                aria-checked={digest.enabled}
                aria-label="Toggle daily digest"
                disabled={digestSaving}
                onClick={() => saveDigest({ enabled: !digest.enabled })}
                className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
                  digest.enabled ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-slate-700"
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${digest.enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-account AI keys — encrypted, synced, rotated on quota */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 mb-6 overflow-hidden">
        <button
          onClick={() => setKeysOpen((o) => !o)}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-slate-800/40 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound size={15} className="text-teal-400" />
            AI API keys
            <span className="text-[11px] font-normal text-slate-500">
              {aiKeys.gemini.length} Gemini · {aiKeys.groq.length} Groq · stored encrypted on your account
            </span>
          </span>
          {keysOpen ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
        </button>
        {keysOpen && (
          <div className="px-4 pb-4 border-t border-slate-700/40 pt-3 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">
                Your keys power job search and email drafts on any device you sign in from. Add several per provider —
                when one runs out of daily quota, the next takes over automatically.
              </p>
              {(aiKeys.gemini.length > 0 || aiKeys.groq.length > 0) && (
                <button
                  onClick={toggleRevealKeys}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition"
                >
                  {keysRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                  {keysRevealed ? "Hide" : "Show full keys"}
                </button>
              )}
            </div>
            {keyMsg && <p className="text-xs text-teal-300">{keyMsg}</p>}
            {keyErr && <p className="text-xs text-red-400">{keyErr}</p>}
            {(["gemini", "groq"] as const).map((provider) => (
              <div key={provider}>
                <p className="text-xs font-semibold text-slate-300 mb-1.5">
                  {provider === "gemini" ? "Gemini (primary)" : "Groq (backup)"}
                  <span className="text-slate-600 font-normal"> — {provider === "gemini" ? "aistudio.google.com/apikey" : "console.groq.com/keys"}</span>
                </p>
                <div className="space-y-1.5">
                  {aiKeys[provider].map((k, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5">
                      <code className="text-xs text-slate-300 flex-1 truncate select-text">{k}</code>
                      {keysRevealed && (
                        <button onClick={() => copyText(k)} title="Copy key" className="text-slate-500 hover:text-teal-300 transition">
                          <Copy size={12} />
                        </button>
                      )}
                      <button onClick={() => deleteKey(provider, i)} title="Remove key" className="text-slate-500 hover:text-red-400 transition">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      className="input-field !py-1.5 text-xs"
                      type="password"
                      placeholder={provider === "gemini" ? "Paste your Gemini API key" : "Paste your Groq API key"}
                      value={keyInput[provider]}
                      onChange={(e) => onKeyInput(provider, e.target.value)}
                      onBlur={() => { if (looksComplete(provider, keyInput[provider])) addKey(provider); }}
                      onKeyDown={(e) => { if (e.key === "Enter") addKey(provider); }}
                    />
                    <button
                      onClick={() => addKey(provider)}
                      disabled={!keyInput[provider].trim() || keyBusy === provider}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-200 text-xs hover:bg-teal-500/20 transition disabled:opacity-40"
                    >
                      {keyBusy === provider
                        ? <><Loader2 size={12} className="animate-spin" /> Saving</>
                        : <><Plus size={12} /> Add</>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resumes for one-click apply — upload once, stored permanently */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-teal-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Resumes for one-click apply</p>
              <p className="text-[11px] text-slate-500">
                Upload once, saved forever. Name them with &ldquo;AI&rdquo; and &ldquo;Python&rdquo; — the ➤ button attaches the right one automatically.
              </p>
            </div>
          </div>
          <label className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-200 text-sm hover:bg-teal-500/20 transition cursor-pointer ${uploadingResumes ? "opacity-50 pointer-events-none" : ""}`}>
            {uploadingResumes ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingResumes ? "Saving..." : "Add resumes"}
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => { uploadResumes(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>
        {resumeMsg && <p className="text-xs text-teal-300 mt-2">{resumeMsg}</p>}
        {jfResumes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {jfResumes.map((r) => {
              const kind = resumeKind(r);
              return (
                <span key={r.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200">
                  <FileText size={12} className="text-slate-500" />
                  <span className="max-w-[180px] truncate">{r.filename}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    kind === "ai" ? "bg-violet-500/20 text-violet-300"
                    : kind === "python" ? "bg-teal-500/20 text-teal-300"
                    : "bg-slate-700 text-slate-400"
                  }`}>
                    {kind === "ai" ? "AI roles" : kind === "python" ? "Python roles" : "any role"}
                  </span>
                  <span className="text-slate-600">{(r.sizeBytes / 1024).toFixed(0)} KB</span>
                  <button onClick={() => deleteResume(r.id)} title="Delete" className="text-slate-500 hover:text-red-400 transition">
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
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
                    sendBusy={sendBusyId === l.id}
                    copied={copiedId === l.id}
                    onCopy={() => copyLead(l)}
                    onToggle={() => setExpandedId(expandedId === l.id ? "" : l.id)}
                    onEdit={() => startEdit(l)}
                    onSave={saveEdit}
                    onCancelEdit={() => { setEditingId(""); setDraft({}); }}
                    onDelete={() => removeLead(l.id)}
                    onStatus={(s) => patchLead(l.id, { status: s })}
                    onSendMail={() => sendMailFor(l.id)}
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
  lead: l, expanded, editing, draft, setDraft, sendBusy, copied,
  onToggle, onEdit, onSave, onCancelEdit, onDelete, onStatus, onSendMail, onCopy,
}: {
  lead: JobLead;
  expanded: boolean;
  editing: boolean;
  draft: Partial<JobLead>;
  setDraft: (d: Partial<JobLead>) => void;
  sendBusy: boolean;
  copied: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onStatus: (s: LeadStatus) => void;
  onSendMail: () => void;
  onCopy: () => void;
}) {
  const status = STATUS_OPTIONS.find((s) => s.value === l.status) || STATUS_OPTIONS[0];
  return (
    <>
      <tr
        className="hover:bg-slate-800/30 transition cursor-pointer"
        onClick={(e) => {
          // The whole row toggles the detail view — except clicks on real
          // controls (links, buttons, selects, inputs) inside it, and except
          // when the user is selecting text to copy it.
          if ((e.target as HTMLElement).closest("a,button,select,input,textarea")) return;
          if (window.getSelection()?.toString()) return;
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
              onClick={onSendMail}
              disabled={sendBusy || !l.contactEmail}
              title={l.contactEmail
                ? `One-click apply: auto-picks your AI or Python resume from the role and sends to ${l.contactEmail}`
                : "No contact email on this job — add one via ✏️ Edit first"}
              className="p-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/25 transition disabled:opacity-40"
            >
              {sendBusy ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={14} />}
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
