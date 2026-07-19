"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Search, MapPin, Building2, ExternalLink, Loader2, Upload, FileText,
  Shield, Sparkles, Clock, Wallet, Globe, Info,
} from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  postedDate: string;
  salary: string;
  remote: boolean;
  snippet: string;
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  Adzuna: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Jooble: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  Remotive: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  RemoteOK: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Arbeitnow: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
};

export default function JobsPage() {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("India");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [bySource, setBySource] = useState<Record<string, number>>({});
  const [keyedActive, setKeyedActive] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const [parsing, setParsing] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [resumeName, setResumeName] = useState("");
  const resumeRef = useRef<HTMLInputElement>(null);

  async function handleResume(file: File) {
    setParsing(true);
    setError("");
    setResumeName(file.name);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch("/api/job-search/resume-keywords", { method: "POST", body: fd });
      const data = await res.json();
      if (data.keywords) setKeywords(data.keywords);
      if (Array.isArray(data.skills)) setSkills(data.skills);
      if (!data.parsed) setError("Couldn't read that PDF — type your role/skills below instead.");
    } catch {
      setError("Couldn't read that resume — type your role/skills below instead.");
    }
    setParsing(false);
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!keywords.trim() && !location.trim()) return;
    setSearching(true);
    setSearched(true);
    setError("");
    try {
      const res = await fetch("/api/job-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, location, remoteOnly }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Search failed"); setJobs([]); }
      else {
        setJobs(data.jobs || []);
        setBySource(data.bySource || {});
        setKeyedActive(!!data.keyedActive);
      }
    } catch {
      setError("Network error while searching.");
      setJobs([]);
    }
    setSearching(false);
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <Search size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Job Finder</h1>
            <p className="text-slate-500 text-xs">Free public sources · your accounts never touched</p>
          </div>
        </div>
        <ModeToggle active="jobs" />
      </div>

      {/* Safety note */}
      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
        <Shield size={16} className="text-teal-400 mt-0.5 shrink-0" />
        <p className="text-xs text-teal-200/80 leading-relaxed">
          Jobs come only from <span className="text-teal-300 font-medium">official free job APIs</span> — nothing logs into or scrapes LinkedIn, Naukri or Indeed, so your accounts can&apos;t be banned. Apply using each job&apos;s own link.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: search controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Resume upload */}
          <div className="glass-card !border-teal-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-teal-400" />
              <h2 className="text-sm font-semibold text-white">Match to your resume</h2>
            </div>
            <div
              className="rounded-xl border-2 border-dashed border-teal-500/30 bg-teal-500/5 p-4 text-center cursor-pointer hover:border-teal-500/60 transition"
              onClick={() => resumeRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleResume(f); }}
            >
              <input ref={resumeRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResume(f); }} />
              {parsing ? (
                <div className="flex items-center justify-center gap-2 text-teal-300 text-sm"><Loader2 size={16} className="animate-spin" /> Reading resume…</div>
              ) : resumeName ? (
                <div className="flex items-center justify-center gap-2 text-teal-300 text-sm"><FileText size={16} />{resumeName}</div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload size={22} className="text-teal-400/70" />
                  <p className="text-xs text-slate-400">Drop your resume PDF to auto-fill skills</p>
                </div>
              )}
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {skills.map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Search form */}
          <form onSubmit={search} className="glass-card !border-teal-500/20 space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Role / Skills</label>
              <input className="input-field" placeholder="e.g. Python Developer, FastAPI"
                value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Location</label>
              <input className="input-field" placeholder="India, Bangalore, Remote…"
                value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)}
                className="accent-teal-500 w-4 h-4" />
              Remote only
            </label>
            <button type="submit" disabled={searching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-teal-500/25 hover:brightness-110 transition disabled:opacity-60">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {searching ? "Searching…" : "Find jobs"}
            </button>
          </form>

          <p className="text-[11px] text-slate-600 px-1">
            Tip: attach the matching resume in the <Link href="/" className="text-violet-400 hover:underline">Outreach</Link> tab when you apply by email.
          </p>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200 flex items-start gap-2">
              <Info size={15} className="mt-0.5 shrink-0" />{error}
            </div>
          )}

          {searched && !searching && !keyedActive && (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 text-xs text-sky-200/90 flex items-start gap-2">
              <Globe size={14} className="mt-0.5 shrink-0" />
              <span>Showing <b>remote</b> jobs only. To include <b>India</b> listings, add the free Adzuna + Jooble API keys (see the setup note the developer gave you).</span>
            </div>
          )}

          {searched && !searching && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-400">
                {jobs.length > 0 ? <><span className="text-white font-semibold">{jobs.length}</span> jobs found</> : "No jobs found — try broader keywords or a different location."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(bySource).map(([s, n]) => (
                  <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full border ${SOURCE_COLORS[s] || "bg-slate-700/40 text-slate-300 border-slate-600/40"}`}>{s} {n}</span>
                ))}
              </div>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin text-teal-400" />
              <p className="text-sm">Searching free job sources…</p>
            </div>
          )}

          {!searched && !searching && (
            <div className="glass-card !border-teal-500/20 text-center py-14">
              <Search size={30} className="text-teal-400/60 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">Search jobs across free sources</p>
              <p className="text-sm text-slate-500 mt-1">Drop your resume or type a role, then hit <span className="text-teal-300">Find jobs</span>.</p>
            </div>
          )}

          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="glass-card !p-4 !border-slate-700/40 hover:!border-teal-500/40 transition group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white leading-snug">{job.title}</h3>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 min-w-0"><Building2 size={12} className="shrink-0" /><span className="truncate">{job.company}</span></span>
                      {job.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{job.location}</span>}
                      {job.remote && <span className="text-teal-300 bg-teal-500/10 border border-teal-500/20 rounded px-1.5 py-0.5 text-[10px]">Remote</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${SOURCE_COLORS[job.source] || "bg-slate-700/40 text-slate-300 border-slate-600/40"}`}>{job.source}</span>
                </div>

                {job.snippet && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{job.snippet}</p>}

                <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    {job.postedDate && <span className="inline-flex items-center gap-1"><Clock size={11} />{timeAgo(job.postedDate)}</span>}
                    {job.salary && <span className="inline-flex items-center gap-1 text-emerald-400/80"><Wallet size={11} />{job.salary}</span>}
                  </div>
                  <a href={job.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-200 text-xs font-medium hover:bg-teal-500/25 transition">
                    Apply <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
