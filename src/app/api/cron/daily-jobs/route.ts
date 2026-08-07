import { NextRequest, NextResponse } from "next/server";
import { ADMIN_EMAIL, getSession } from "@/lib/auth";
import { searchJobs } from "@/lib/jobSearch";
import { appendLeads, type JobLead } from "@/lib/jobLeads";
import { getAiKeysForUse } from "@/lib/settings";
import { resolveTransport, sendOne } from "@/lib/mailer";

// Daily Ahmedabad job digest.
//
// Vercel Cron calls this once a morning: it runs the same curated Gujarat search
// the "Find in Ahmedabad" button runs, saves anything new to the leads table, and
// emails the account owner a digest FROM their own mailbox TO themselves — so the
// table is already filled in by the time the app is opened.
//
// Nothing is emailed when nothing new is found. A daily "0 new jobs" message
// trains you to ignore the mail, which defeats the point of sending it at all.

export const maxDuration = 60;

// Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var is set.
// The admin's own browser session is also accepted so the job can be triggered
// by hand to verify it works, without waiting a day for the schedule.
async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const session = await getSession();
  if (session.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  // No secret configured and no admin session: on Vercel the platform still
  // marks its own scheduler requests, so accept those rather than silently
  // never running. Any other caller is rejected.
  return !secret && !!req.headers.get("x-vercel-cron");
}

function digest(leads: JobLead[]): string {
  const lines = leads.map((l, i) => {
    const bits = [
      `${i + 1}. ${l.role} — ${l.company}`,
      l.postedWhen ? `   Posted:     ${l.postedWhen}` : "",
      l.experience ? `   Experience: ${l.experience}` : "",
      l.location ? `   Location:   ${l.location}` : "",
      l.package ? `   Package:    ${l.package}` : "",
      l.source ? `   Source:     ${l.source}` : "",
      `   Apply:      ${l.applyLink}`,
    ];
    return bits.filter(Boolean).join("\n");
  });

  return [
    `${leads.length} new job${leads.length === 1 ? "" : "s"} in Ahmedabad, Gandhinagar and Vadodara.`,
    "",
    "Newest first. Already-saved roles are filtered out, so everything below is new",
    "since the last run.",
    "",
    lines.join("\n\n"),
    "",
    "---",
    "Open the app to apply in one click, or edit and track these in your leads table.",
    "Reach.io · daily Ahmedabad search",
  ].join("\n");
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = ADMIN_EMAIL;
  try {
    const aiKeys = await getAiKeysForUse(email);
    if (!aiKeys.gemini.length && !aiKeys.groq.length) {
      // Not an error worth retrying — the account simply has no key yet.
      return NextResponse.json({ ok: false, reason: "no-ai-key", sent: false });
    }

    const { jobs, provider } = await searchJobs("", "", aiKeys, "gujarat");
    const { added, skipped } = await appendLeads(email, jobs, "Daily cron · Ahmedabad");

    if (!added.length) {
      return NextResponse.json({ ok: true, found: jobs.length, added: 0, skipped, provider, sent: false });
    }

    // Send from the account's own mailbox back to itself.
    const transport = await resolveTransport(email);
    if (transport.method === null) {
      // The leads are already saved — failing to mail them is not a lost run.
      return NextResponse.json({
        ok: true, found: jobs.length, added: added.length, skipped, provider,
        sent: false, mailError: transport.error,
      });
    }

    await sendOne(transport, {
      to: email,
      subject: `${added.length} new Ahmedabad job${added.length === 1 ? "" : "s"} — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      body: digest(added),
    });

    return NextResponse.json({
      ok: true, found: jobs.length, added: added.length, skipped, provider, sent: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Daily job run failed";
    console.error("[cron/daily-jobs]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
