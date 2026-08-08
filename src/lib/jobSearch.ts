// Server-only Job Finder engine — COMPLETELY separate from the outreach/mail code.
// Primary: Gemini 2.5 Flash with Google Search grounding (the model runs real
// Google searches server-side). Backup: Groq "compound" (its web-search model).
// Both are asked for strict JSON; we validate and keep only rows with a real link.

import { geminiGenerate, geminiTextFrom } from "./gemini";
import { CANDIDATE_FACTS } from "./candidate";

export interface FoundJob {
  company: string;
  role: string;
  experience: string;
  package: string;
  location: string;
  jd: string;
  applyLink: string;
  careerPage: string;
  contactEmail: string;
  contactPhone: string;
  postedWhen: string;
  source: string;
}

// Phrasing matters for Groq's compound agent: "Search the web" reliably
// triggers its search tool; "Search Google" or aggressive commands make it
// refuse ("I can't search Google" / "I can't fulfill that request").
export const SEARCH_PROMPT = (query: string, location: string) => `Search the web for REAL job postings that are currently open and match:

ROLE QUERY: ${query}
LOCATION: ${location || "India or Remote"}

Interpret EXPERIENCE broadly: if the query says "1 year experience", include postings asking for 0-1, 0-2, 1-2, 1-3 years, "fresher", "junior" or "entry level" — any posting a person with that experience could apply to. Same logic for other experience values.

Interpret LOCATION helpfully: prefer ${location || "India"}, but when the city has few results also include Remote (India) and hybrid roles in nearby major cities.

Rules:
- Only genuine postings from company career pages, ATS boards (Greenhouse, Lever, Ashby, Workable, SmartRecruiters), Wellfound, or reputable job boards. NO staffing agencies, NO consultancies, NO "urgent hiring" spam.
- Prefer recent postings (last 14 days).
- Find 6-10 jobs. Every job MUST have a working http(s) link.
- For each job also try to find the company's own careers page URL, and a public hiring/contact email or phone if one exists — use "" when not found. Never invent contact details.

Return ONLY a JSON array (no markdown, no commentary). Each element exactly:
{
  "company": "", "role": "", "experience": "e.g. 0-2 years or \\"\\"",
  "package": "salary if stated, else \\"\\"", "location": "",
  "jd": "3-4 line summary, max 60 words", "applyLink": "direct URL",
  "careerPage": "", "contactEmail": "", "contactPhone": "",
  "postedWhen": "e.g. 2 days ago or \\"\\"", "source": "domain the posting is on"
}`;

// ---------------------------------------------------------------------------
// One-click preset searches.
//
// The manual box above answers whatever you type. These two answer the question
// you actually ask every morning — "what opened near me?" and "what opened
// anywhere?" — with the search discipline that free-text prompting keeps losing:
// a 30-day window (a 7-day cut leaves Ahmedabad with almost nothing), an
// experience ceiling, and a hard ban on inventing a row to pad the list.
// ---------------------------------------------------------------------------

export type SearchScope = "gujarat" | "india";

const SCOPE_AREA: Record<SearchScope, string> = {
  gujarat:
    "Ahmedabad, Gandhinagar (including GIFT City) and Vadodara, Gujarat. " +
    "Search Vadodara as its own separate query — it is a much smaller market than " +
    "Ahmedabad and gets buried inside a generic 'Gujarat' search. Also include " +
    "fully-remote roles posted by Gujarat-based companies.",
  india:
    "anywhere in India, plus fully-remote roles that accept India-based candidates " +
    "(not 'US remote only'). Prioritise, in order: Remote · Bengaluru · Pune · " +
    "Hyderabad · Gurugram/Noida/Delhi NCR · Mumbai · Chennai · Ahmedabad — but do " +
    "not exclude other cities.",
};

const SCOPE_TITLES =
  "AI Engineer · GenAI / Generative AI Engineer · Applied AI Engineer · Agentic AI " +
  "Engineer · LLM Engineer · AI Solution Engineer · Associate AI Engineer · RAG " +
  "Engineer · Forward Deployed Engineer · Python Developer · Python Backend " +
  "Developer · Backend Engineer (Python) · Software Engineer (Python) · API " +
  "Developer · AI/ML Engineer · Machine Learning Engineer (only when the role is " +
  "Python/LLM engineering, not PhD-track research) · Data Engineer (only when " +
  "Python + streaming, never pure SQL/BI)";

export const SCOPE_PROMPT = (scope: SearchScope) => `Search the web for REAL, currently-open job postings in ${SCOPE_AREA[scope]}

CANDIDATE: ~2 years experience. Stack: ${CANDIDATE_FACTS.stack.join(", ")}.
Rare differentiators worth matching against a job description: production MCP
tool-calling agents, agentic/ReAct systems, RAG pipelines, self-hosted and
air-gapped LLMs, Kafka to ClickHouse streaming.

TARGET TITLES: ${SCOPE_TITLES}

TIME WINDOW — the last 30 days. Do NOT restrict to 7 days: Indian roles stay open
for weeks and a one-week cut throws away most of the real opportunities. Put the
age tier in "postedWhen": FRESH (0-7 days), RECENT (8-14 days), OPEN (15-30 days),
each followed by the actual age, e.g. "FRESH · 3 days ago".

EXPERIENCE — include roles asking 0 to 4 years, and roles that state no experience
at all (those are often the best odds). EXCLUDE anything titled Senior, Sr., Lead,
Principal, Staff, Architect, Manager, Head, Director or VP, unless the posting
explicitly accepts 2 years or less. Exclude internships and unpaid roles.

ALSO EXCLUDE: pure MLOps/DevOps, pure Data Science/statistics, BI/PowerBI/Tableau
analyst, QA/testing, frontend-only, and PHP/.NET/Java-only roles. Skip staffing
agencies that do not name the actual employer.

SEARCH BREADTH — never answer from a single job board.

MANDATORY — search all four of these every time, as separate queries:
  1. LinkedIn Jobs
  2. Naukri.com
  3. Indeed India
  4. Wellfound (AngelList)

ALSO SEARCH: Cutshort · Instahyre · Hirist · foundit (Monster) · Glassdoor ·
Internshala · SimplyHired · Jooble · Weekday · Uplers · Shine · TimesJobs.

AND search applicant-tracking boards directly — Greenhouse (boards.greenhouse.io),
Lever (jobs.lever.co), Ashby (jobs.ashbyhq.com), Workable, SmartRecruiters,
Recruitee, Zoho Recruit, Keka, Darwinbox. This is where companies actually post:
roles appear here before any aggregator scrapes them, and closed roles are really
removed instead of lingering — aggregators never delete anything, which is the
single biggest source of dead listings.

Finally, open the career page of any company you find, since employers routinely
list roles there that reach no job board at all.

If one of the mandatory four returns nothing or blocks you, say so explicitly in
the "source" field of the rows you did find rather than quietly skipping it.

ORDER — newest first, most recently posted at the top.

ACCURACY — this matters more than the length of the list:
- Every row needs a real, working http(s) link to the posting itself.
- Never invent a company, a salary, an experience range or a contact detail.
  Use "" for anything you cannot find on a real page.
- Never include a company just because it is well known or hired before — it must
  have a live posting you actually found.
- Return 8-15 jobs. If fewer genuinely qualify, return fewer. Do not pad the list.

Return ONLY a JSON array (no markdown, no commentary). Each element exactly:
{
  "company": "", "role": "", "experience": "e.g. 0-2 years or \\"\\"",
  "package": "salary if stated, else \\"\\"", "location": "city or Remote",
  "jd": "3-4 line summary, max 60 words", "applyLink": "direct URL",
  "careerPage": "", "contactEmail": "", "contactPhone": "",
  "postedWhen": "e.g. FRESH · 3 days ago", "source": "domain the posting is on"
}`;

const CONTACT_PROMPT = (company: string, role: string) => `Search the web for the company "${company}" (which is hiring for "${role}").
Find:
1. their official careers/jobs page URL
2. a PUBLIC hiring or general contact email address (careers@..., hr@..., hello@... from their own website)
3. a public phone number from their own website

Never invent anything — use "" for anything you cannot find on a real page.
Return ONLY JSON: {"careerPage": "", "contactEmail": "", "contactPhone": ""}`;

function extractJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  // Grab the outermost JSON array/object even if the model added prose around it.
  const start = Math.min(
    ...[cleaned.indexOf("["), cleaned.indexOf("{")].filter((i) => i >= 0),
  );
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (!isFinite(start) || end <= start) throw new Error("No JSON found in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function geminiGroundedSearch(prompt: string, apiKeys: string[]): Promise<string> {
  const { data } = await geminiGenerate(apiKeys, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2 },
  });
  const text = geminiTextFrom(data);
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

// Groq web-search fallback. Only compound-mini is usable on this tier (the
// full compound 413s), but mini sometimes answers in prose instead of JSON —
// so: try mini twice, and if we got *some* searched text without JSON, convert
// that text to JSON with plain llama in strict JSON mode (it restructures the
// found data, it does not invent jobs).
async function groqJsonify(rawText: string, apiKeys: string[]): Promise<string> {
  let lastErr = "";
  for (const apiKey of apiKeys) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Convert the user\'s text into JSON. Extract ONLY information present in the text — never invent. Return {"jobs": [...]} where each job has: company, role, experience, package, location, jd, applyLink, careerPage, contactEmail, contactPhone, postedWhen, source (all strings, "" when absent). Skip anything without a URL.',
          },
          { role: "user", content: rawText.slice(0, 12000) },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const obj = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
      return JSON.stringify(Array.isArray(obj.jobs) ? obj.jobs : []);
    }
    lastErr = `Groq jsonify ${res.status}`;
    if (![429, 413, 401, 403].includes(res.status)) throw new Error(lastErr);
  }
  throw new Error(lastErr || "No Groq key");
}

// Phrases a model uses when it declines to search, rather than search and fail.
const REFUSAL_RE =
  /\b(?:i(?:'m| am)? ?(?:unable|not able) to (?:perform|do|run|carry out|access|browse|search)|i (?:can(?:no|')t|cannot) (?:search|browse|access|retrieve|perform)|do(?:n'| no)t have (?:access|the ability|browsing)|no (?:access to|ability to) (?:the )?(?:internet|web))/i;

// Rows a model invents to demonstrate the schema instead of returning real data.
const PLACEHOLDER_RE =
  /\b(?:example\s*(?:corp|company|inc|ltd)|acme|your\s*company|company\s*name|sample\s*(?:corp|company)|xyz\s*(?:corp|company|ltd))\b|example\.(?:com|org|net)/i;

async function groqCompoundSearch(prompt: string, apiKeys: string[]): Promise<string> {
  let lastErr = "";
  let proseAnswer = "";
  for (const apiKey of apiKeys) {
    // Mini refuses to search on some calls — give it three chances (each refusal
    // is only a few seconds) before the big compound, which 413s on some tiers.
    for (const model of ["groq/compound-mini", "groq/compound-mini", "groq/compound-mini", "groq/compound"]) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        lastErr = `Groq ${res.status} (${model}): ${errText.slice(0, 160)}`;
        // Quota / bad key → rotate to the next key.
        if (res.status === 429 || res.status === 401 || res.status === 403) break;
        // 413 too large / 404 unknown model / 400 → try next attempt; else real error.
        if (res.status !== 413 && res.status !== 404 && res.status !== 400) throw new Error(lastErr);
        continue;
      }
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content || "";

      // Refusals must be detected by what they SAY, not by whether a URL is
      // present. compound-mini declines with "I'm unable to perform a live web
      // search" and then helpfully demonstrates the schema with Example Corp and
      // a placeholder link — which satisfies a naive "has a URL and a brace"
      // test, so the refusal was being returned as though it were results and
      // surfaced to the user as a truthful-looking "Found 0".
      if (REFUSAL_RE.test(text)) {
        lastErr = `Groq (${model}) refused to run a web search`;
        continue;
      }

      const searched = /https?:\/\//i.test(text);
      if (searched && /[\[{]/.test(text)) return text;
      if (searched) proseAnswer = text; // real searched content, wrong shape
      lastErr = searched ? `Groq (${model}) answered without JSON` : `Groq (${model}) skipped its web search`;
    }
  }
  // Salvage: the search worked but came back as prose — restructure it.
  if (proseAnswer) return groqJsonify(proseAnswer, apiKeys);
  if (lastErr.includes("refused")) {
    throw new Error(
      `${lastErr}. Groq's search model declines fairly often, so it is a weak backup. ` +
        "Add a second Gemini key from a different Google account in the AI keys section — " +
        "each key carries its own quota and the app rotates between them automatically.",
    );
  }
  throw new Error(lastErr || "No Groq API key on your account");
}

export interface AiKeys {
  gemini: string[];
  groq: string[];
}

// Run a prompt through Gemini-with-search first, Groq compound as backup —
// using the USER'S stored keys (rotated on quota), never env at runtime.
async function searchWithFallback(prompt: string, keys: AiKeys): Promise<{ text: string; provider: "gemini" | "groq" }> {
  if (!keys.gemini.length && !keys.groq.length) {
    throw new Error("No AI key on your account — add your Gemini API key (and optionally Groq) in the AI keys section above.");
  }
  let geminiError = "";
  if (keys.gemini.length) {
    try {
      return { text: await geminiGroundedSearch(prompt, keys.gemini), provider: "gemini" };
    } catch (e) {
      geminiError = e instanceof Error ? e.message : String(e);
    }
  }
  if (keys.groq.length) {
    try {
      return { text: await groqCompoundSearch(prompt, keys.groq), provider: "groq" };
    } catch (e) {
      const groqError = e instanceof Error ? e.message : String(e);
      throw new Error(geminiError ? `Gemini: ${geminiError} · Groq: ${groqError}` : `Groq: ${groqError}`);
    }
  }
  throw new Error(`Gemini failed and no Groq backup key on your account. ${geminiError}`);
}

function cleanStr(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Validate any model's raw text into clean job rows — shared by the normal
// Gemini/Groq path and the local Claude path so every source meets the same bar.
export function parseJobsText(text: string): FoundJob[] {
  const raw = extractJson<unknown[]>(text);
  if (!Array.isArray(raw)) throw new Error("Model did not return a job list");
  const jobs: FoundJob[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const job: FoundJob = {
      company: cleanStr(o.company, 120),
      role: cleanStr(o.role, 160),
      experience: cleanStr(o.experience, 60),
      package: cleanStr(o.package, 80),
      location: cleanStr(o.location, 120),
      jd: cleanStr(o.jd, 500),
      applyLink: cleanStr(o.applyLink, 500),
      careerPage: cleanStr(o.careerPage, 500),
      contactEmail: cleanStr(o.contactEmail, 160),
      contactPhone: cleanStr(o.contactPhone, 40),
      postedWhen: cleanStr(o.postedWhen, 60),
      source: cleanStr(o.source, 120),
    };
    // A job without a company or any real link is noise — but if only the
    // apply link is missing and we have the career page, use that instead of
    // throwing the whole row away.
    if (!job.company) continue;
    // "Example Corp" / example.com rows are the model demonstrating the schema,
    // not a posting it found. Letting one through would put a fake employer in
    // the leads table and, worse, make a refusal look like a successful search.
    if (PLACEHOLDER_RE.test(job.company) || PLACEHOLDER_RE.test(job.applyLink)) continue;
    if (!/^https?:\/\//i.test(job.applyLink)) {
      if (/^https?:\/\//i.test(job.careerPage)) job.applyLink = job.careerPage;
      else continue;
    }
    jobs.push(job);
  }
  return jobs;
}

// scope set → run the curated preset; otherwise answer the typed query.
export async function searchJobs(
  query: string,
  location: string,
  keys: AiKeys,
  scope?: SearchScope,
): Promise<{ jobs: FoundJob[]; provider: string }> {
  const prompt = scope ? SCOPE_PROMPT(scope) : SEARCH_PROMPT(query, location);
  const { text, provider } = await searchWithFallback(prompt, keys);
  return { jobs: parseJobsText(text), provider };
}

export async function findContact(company: string, role: string, keys: AiKeys): Promise<{ careerPage: string; contactEmail: string; contactPhone: string; provider: string }> {
  const { text, provider } = await searchWithFallback(CONTACT_PROMPT(company, role), keys);
  const o = extractJson<Record<string, unknown>>(text);
  return {
    careerPage: cleanStr(o.careerPage, 500),
    contactEmail: cleanStr(o.contactEmail, 160),
    contactPhone: cleanStr(o.contactPhone, 40),
    provider,
  };
}
