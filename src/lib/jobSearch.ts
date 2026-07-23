// Server-only Job Finder engine — COMPLETELY separate from the outreach/mail code.
// Primary: Gemini 2.5 Flash with Google Search grounding (the model runs real
// Google searches server-side). Backup: Groq "compound" (its web-search model).
// Both are asked for strict JSON; we validate and keep only rows with a real link.

import { geminiGenerate, geminiTextFrom } from "./gemini";

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

const SEARCH_PROMPT = (query: string, location: string) => `Use your web search tool NOW — do not answer from memory and do not say you cannot search. Run multiple searches for REAL job postings that are currently open and match:

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

const CONTACT_PROMPT = (company: string, role: string) => `Search Google for the company "${company}" (which is hiring for "${role}").
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

async function geminiGroundedSearch(prompt: string, apiKey: string): Promise<string> {
  const { data } = await geminiGenerate(apiKey, {
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
async function groqJsonify(rawText: string, apiKey: string): Promise<string> {
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
  if (!res.ok) throw new Error(`Groq jsonify ${res.status}`);
  const data = await res.json();
  const obj = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
  return JSON.stringify(Array.isArray(obj.jobs) ? obj.jobs : []);
}

async function groqCompoundSearch(prompt: string, apiKey: string): Promise<string> {
  let lastErr = "";
  let proseAnswer = "";
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
      // 413 too large / 404 unknown model / 400 → try next attempt; else real error.
      if (res.status !== 413 && res.status !== 404 && res.status !== 400) throw new Error(lastErr);
      continue;
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    // A refusal ("I can't search the web") has no URLs — retry, never accept it.
    const searched = /https?:\/\//i.test(text);
    if (searched && /[\[{]/.test(text)) return text;
    if (searched) proseAnswer = text; // real searched content, wrong shape
    lastErr = searched ? `Groq (${model}) answered without JSON` : `Groq (${model}) skipped its web search`;
  }
  // Salvage: the search worked but came back as prose — restructure it.
  if (proseAnswer) return groqJsonify(proseAnswer, apiKey);
  throw new Error(lastErr);
}

// Run a prompt through Gemini-with-search first, Groq compound as backup.
async function searchWithFallback(prompt: string): Promise<{ text: string; provider: "gemini" | "groq" }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey && !groqKey) {
    throw new Error("No AI key configured — add GEMINI_API_KEY (and optionally GROQ_API_KEY).");
  }
  let geminiError = "";
  if (geminiKey) {
    try {
      return { text: await geminiGroundedSearch(prompt, geminiKey), provider: "gemini" };
    } catch (e) {
      geminiError = e instanceof Error ? e.message : String(e);
    }
  }
  if (groqKey) {
    try {
      return { text: await groqCompoundSearch(prompt, groqKey), provider: "groq" };
    } catch (e) {
      const groqError = e instanceof Error ? e.message : String(e);
      throw new Error(geminiError ? `Gemini: ${geminiError} · Groq: ${groqError}` : `Groq: ${groqError}`);
    }
  }
  throw new Error(`Gemini failed and no Groq backup key set. ${geminiError}`);
}

function cleanStr(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function searchJobs(query: string, location: string): Promise<{ jobs: FoundJob[]; provider: string }> {
  const { text, provider } = await searchWithFallback(SEARCH_PROMPT(query, location));
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
    if (!/^https?:\/\//i.test(job.applyLink)) {
      if (/^https?:\/\//i.test(job.careerPage)) job.applyLink = job.careerPage;
      else continue;
    }
    jobs.push(job);
  }
  return { jobs, provider };
}

export async function findContact(company: string, role: string): Promise<{ careerPage: string; contactEmail: string; contactPhone: string; provider: string }> {
  const { text, provider } = await searchWithFallback(CONTACT_PROMPT(company, role));
  const o = extractJson<Record<string, unknown>>(text);
  return {
    careerPage: cleanStr(o.careerPage, 500),
    contactEmail: cleanStr(o.contactEmail, 160),
    contactPhone: cleanStr(o.contactPhone, 40),
    provider,
  };
}
