import { NextRequest } from "next/server";
import { ok, bad, requireUser } from "@/app/api/jobs/_helpers";

// Aggregates job postings from FREE, official public job APIs only. It never
// touches the user's LinkedIn/Naukri/Indeed accounts and never scrapes — so it
// cannot get any personal account banned. Sources that need a (free) key are
// simply skipped when the key isn't configured.

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;        // apply / listing link
  source: string;
  postedDate: string; // ISO string or ""
  salary: string;     // "" if unknown
  remote: boolean;
  snippet: string;
}

const UA = "Mozilla/5.0 (compatible; ReachIoJobFinder/1.0)";

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function jobId(title: string, company: string, url: string): string {
  return `${title}|${company}|${url}`.toLowerCase().replace(/\s+/g, "").slice(0, 200);
}

async function fetchJson(url: string, opts: RequestInit = {}, ms = 9000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers || {}) },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const kw = (q: string) => q.trim().toLowerCase();
function matches(text: string, q: string): boolean {
  if (!q) return true;
  const t = (text || "").toLowerCase();
  return kw(q).split(/\s+/).some((w) => w.length > 1 && t.includes(w));
}

// ---------- Source fetchers (each isolated; return [] on any failure) ----------

// Adzuna — India country endpoint (needs free app_id + app_key).
async function adzuna(q: string, location: string): Promise<Job[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const params = new URLSearchParams({
    app_id: id, app_key: key, results_per_page: "40", "content-type": "application/json",
    what: q || "developer",
  });
  if (location && !/remote/i.test(location)) params.set("where", location);
  const data = await fetchJson(`https://api.adzuna.com/v1/api/jobs/in/search/1?${params.toString()}`);
  const rows: any[] = data?.results || [];
  return rows.map((r) => {
    const loc = r.location?.display_name || "";
    const sal = r.salary_min || r.salary_max
      ? `₹${Math.round((r.salary_min || r.salary_max) / 1000)}k${r.salary_max && r.salary_max !== r.salary_min ? `–${Math.round(r.salary_max / 1000)}k` : ""}`
      : "";
    return {
      id: jobId(r.title, r.company?.display_name || "", r.redirect_url),
      title: stripHtml(r.title || ""),
      company: r.company?.display_name || "—",
      location: loc || "India",
      url: r.redirect_url || "",
      source: "Adzuna",
      postedDate: r.created || "",
      salary: sal,
      remote: /remote|work from home|wfh/i.test(`${r.title} ${loc}`),
      snippet: stripHtml(r.description || "").slice(0, 200),
    } as Job;
  });
}

// Jooble — India + global aggregator (needs a free API key).
async function jooble(q: string, location: string): Promise<Job[]> {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return [];
  const data = await fetchJson(`https://jooble.org/api/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: q || "developer", location: location || "India" }),
  });
  const rows: any[] = data?.jobs || [];
  return rows.map((r) => ({
    id: jobId(r.title, r.company || "", r.link),
    title: stripHtml(r.title || ""),
    company: r.company || "—",
    location: r.location || "",
    url: r.link || "",
    source: "Jooble",
    postedDate: r.updated || "",
    salary: r.salary || "",
    remote: /remote|work from home|wfh/i.test(`${r.title} ${r.location}`),
    snippet: stripHtml(r.snippet || "").slice(0, 200),
  } as Job));
}

// Remotive — remote jobs, keyless.
async function remotive(q: string): Promise<Job[]> {
  const data = await fetchJson(`https://remotive.com/api/remote-jobs?limit=40${q ? `&search=${encodeURIComponent(q)}` : ""}`);
  const rows: any[] = data?.jobs || [];
  return rows.map((r) => ({
    id: jobId(r.title, r.company_name || "", r.url),
    title: stripHtml(r.title || ""),
    company: r.company_name || "—",
    location: r.candidate_required_location || "Remote",
    url: r.url || "",
    source: "Remotive",
    postedDate: r.publication_date || "",
    salary: r.salary || "",
    remote: true,
    snippet: stripHtml(r.description || "").slice(0, 200),
  } as Job));
}

// RemoteOK — remote jobs, keyless (first array element is metadata).
async function remoteok(q: string): Promise<Job[]> {
  const data = await fetchJson("https://remoteok.com/api");
  if (!Array.isArray(data)) return [];
  const rows = data.filter((r: any) => r && r.position);
  return rows
    .filter((r: any) => matches(`${r.position} ${(r.tags || []).join(" ")}`, q))
    .map((r: any) => ({
      id: jobId(r.position, r.company || "", r.url),
      title: stripHtml(r.position || ""),
      company: r.company || "—",
      location: r.location || "Remote",
      url: r.url || "",
      source: "RemoteOK",
      postedDate: r.date || "",
      salary: r.salary_min ? `$${r.salary_min}${r.salary_max ? `–${r.salary_max}` : ""}` : "",
      remote: true,
      snippet: stripHtml(r.description || "").slice(0, 200),
    } as Job));
}

// Arbeitnow — keyless job board (remote + EU heavy).
async function arbeitnow(q: string): Promise<Job[]> {
  const data = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
  const rows: any[] = data?.data || [];
  return rows
    .filter((r) => matches(`${r.title} ${(r.tags || []).join(" ")}`, q))
    .map((r) => ({
      id: jobId(r.title, r.company_name || "", r.url),
      title: stripHtml(r.title || ""),
      company: r.company_name || "—",
      location: r.location || "",
      url: r.url || "",
      source: "Arbeitnow",
      postedDate: r.created_at ? new Date(r.created_at * 1000).toISOString() : "",
      salary: "",
      remote: !!r.remote,
      snippet: (r.tags || []).slice(0, 5).join(", "),
    } as Job));
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: { keywords?: string; location?: string; remoteOnly?: boolean };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }
  const keywords = (body.keywords || "").trim();
  const location = (body.location || "").trim();
  const remoteOnly = !!body.remoteOnly;

  // Run every source in parallel; a slow/broken source can't sink the others.
  const settled = await Promise.allSettled([
    adzuna(keywords, location),
    jooble(keywords, location),
    remotive(keywords),
    remoteok(keywords),
    arbeitnow(keywords),
  ]);

  const all: Job[] = [];
  const bySource: Record<string, number> = {};
  for (const s of settled) {
    if (s.status === "fulfilled") {
      for (const j of s.value) {
        if (!j.url || !j.title) continue;
        all.push(j);
        bySource[j.source] = (bySource[j.source] || 0) + 1;
      }
    }
  }

  // Dedupe by id, then optional remote filter, then newest-first.
  const seen = new Set<string>();
  let jobs = all.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)));
  if (remoteOnly) jobs = jobs.filter((j) => j.remote);
  jobs.sort((a, b) => {
    const da = a.postedDate ? new Date(a.postedDate).getTime() : 0;
    const db = b.postedDate ? new Date(b.postedDate).getTime() : 0;
    return db - da;
  });
  jobs = jobs.slice(0, 150);

  const keyedActive = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) || !!process.env.JOOBLE_API_KEY;
  return ok({
    jobs,
    total: jobs.length,
    bySource,
    keyedActive, // false → only keyless remote sources ran (tell the user to add keys for India)
  });
}
