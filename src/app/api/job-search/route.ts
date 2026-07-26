import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { searchJobs, parseJobsText, type FoundJob } from "@/lib/jobSearch";
import { appendLeads, clearLeads, listLeads } from "@/lib/jobLeads";
import { getAiKeysForUse } from "@/lib/settings";
import { claudeLocalAvailable, claudeSearchJobs } from "@/lib/claudeLocal";
import { getSession } from "@/lib/auth";

export const maxDuration = 60;

// POST /api/job-search  { query, location } — run a live AI-grounded Google
// search (Gemini primary, Groq compound backup) and append new finds to the
// user's saved leads table. Fully separate from the outreach/mail feature.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const query = String(body.query || "").trim();
    const location = String(body.location || "").trim();
    if (query.length < 3) {
      return NextResponse.json(
        { error: 'Type what you\'re looking for, e.g. "python developer 1 year experience".' },
        { status: 400 },
      );
    }

    // Local Claude first — ONLY when running on the owner's machine AND the
    // signed-in user is the admin. Everyone else / the deployed site goes
    // straight to the normal per-user Gemini/Groq flow.
    let jobs: FoundJob[] | null = null;
    let provider = "";
    const session = await getSession();
    if (session.role === "admin" && claudeLocalAvailable()) {
      try {
        jobs = parseJobsText(await claudeSearchJobs(query, location));
        provider = "claude";
      } catch (e) {
        // Visible in the dev-server terminal so local failures are debuggable.
        console.error("[claude-local] fell back to Gemini/Groq:", e instanceof Error ? e.message : e);
        jobs = null;
      }
    }

    if (!jobs) {
      const aiKeys = await getAiKeysForUse(auth.email);
      ({ jobs, provider } = await searchJobs(query, location, aiKeys));
    }
    const { added, skipped } = await appendLeads(auth.email, jobs, query);
    const leads = await listLeads(auth.email);

    return NextResponse.json({ found: jobs.length, added: added.length, skipped, provider, leads });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/job-search — the saved leads table.
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ leads: await listLeads(auth.email) });
}

// DELETE /api/job-search — clear the whole table.
export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  await clearLeads(auth.email);
  return NextResponse.json({ ok: true });
}
