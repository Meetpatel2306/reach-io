import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { generatePersonalization } from "@/lib/ai";
import { GENERIC_INBOX, getProject, pickFormatForProject, renderOutreachBody, renderRoleTemplateBody } from "@/lib/candidate";
import { deriveFirstName, listHistory } from "@/lib/jobApp";

// POST /api/ai/personalize
// Body: { company, roleTitle, jdText, recipientName?, recipientTitle?, recipientEmail? }
//
// Runs the hard block rules first (generic inbox, person contacted before,
// company contacted in the last 30 days, daily cap), then asks the AI (Gemini,
// Groq as backup) for the subject + hook + project pick, and renders the final
// body from the fixed template. NOTHING is sent here — the result lands in the
// compose editor for the user to review and edit first.

const DAILY_CAP = 20;
const COMPANY_COOLDOWN_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const company = String(body.company || "").trim();
    const roleTitle = String(body.roleTitle || "").trim();
    const jdText = String(body.jdText || "").trim();
    const recipientName = String(body.recipientName || "").trim();
    const recipientTitle = String(body.recipientTitle || "").trim();
    const recipientEmail = String(body.recipientEmail || "").trim().toLowerCase();
    // Which body format to render around the AI's hook:
    //   "auto"    — pick AI-Engineer vs Python-Developer from the AI's project choice
    //   "ai"      — AI Engineer template (outreach kit 0a)
    //   "backend" — Python Developer template (outreach kit 0b)
    //   "fixed"   — the minimal fixed body (gemini_prompt.md section 5)
    const requestedFormat = String(body.format || "auto");

    if (!company) return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    if (!jdText || jdText.length < 80) {
      return NextResponse.json(
        { error: "Paste the job description (at least a few sentences) — the AI personalises from it." },
        { status: 400 },
      );
    }

    // ---- Hard block rules (checked before spending an AI call) ----
    const blocks: string[] = [];

    if (recipientEmail && GENERIC_INBOX.test(recipientEmail)) {
      blocks.push(
        `${recipientEmail} is a generic inbox (hr@/careers@/info@...). Those are where resumes go to die — find a real person on LinkedIn instead.`,
      );
    }

    const history = await listHistory(auth.email);
    const sentOnly = history.filter((r) => r.status === "sent");

    if (recipientEmail) {
      const person = sentOnly.find((r) => r.contactEmail.toLowerCase() === recipientEmail);
      if (person) {
        blocks.push(`You already emailed this person on ${new Date(person.sentAt).toLocaleDateString()}. Never re-pitch the same person.`);
      }
    }

    if (company) {
      const cutoff = Date.now() - COMPANY_COOLDOWN_DAYS * 86400000;
      const recent = sentOnly.find(
        (r) => !r.isFollowUp && r.company && r.company.toLowerCase() === company.toLowerCase() && new Date(r.sentAt).getTime() >= cutoff,
      );
      if (recent) {
        blocks.push(`${company} was already contacted on ${new Date(recent.sentAt).toLocaleDateString()} — wait ${COMPANY_COOLDOWN_DAYS} days between approaches to the same company.`);
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sentToday = sentOnly.filter((r) => new Date(r.sentAt) >= todayStart).length;
    if (sentToday >= DAILY_CAP) {
      blocks.push(`Daily cap reached (${sentToday}/${DAILY_CAP} today). Burst-sending lands you in spam — continue tomorrow.`);
    }

    if (blocks.length) {
      return NextResponse.json({ blocked: true, blockReasons: blocks });
    }

    // ---- AI call: Gemini primary, Groq fallback ----
    const ai = await generatePersonalization({ company, recipientName, recipientTitle, roleTitle, jdText });

    if (ai.confidence === "low" || !ai.hook) {
      return NextResponse.json({
        blocked: true,
        blockReasons: [
          "The AI couldn't find anything company-specific in that job description to hook onto — a generic email would hurt more than help. Add more of the actual JD text (their product, stack, team), or find a better source.",
        ],
        reason: ai.reason,
        provider: ai.provider,
      });
    }

    const leadProject = getProject(ai.lead_project_id) || getProject("mcp_agent")!;
    const secondProject = ai.second_project_id ? getProject(ai.second_project_id) : null;
    const firstName = deriveFirstName(recipientName, recipientEmail);

    // Auto format: trust the AI's role_type read of the JD; fall back to the
    // lead project's nature if it's ever missing.
    const format: "ai" | "backend" | "fixed" =
      requestedFormat === "ai" || requestedFormat === "backend" || requestedFormat === "fixed"
        ? requestedFormat
        : ai.role_type || pickFormatForProject(leadProject.id);

    const rendered = format === "fixed"
      ? renderOutreachBody({
          recipientFirstName: firstName,
          hook: ai.hook,
          leadProject,
          secondProject,
        })
      : renderRoleTemplateBody(format, { recipientFirstName: firstName, hook: ai.hook });

    // Template-integrity check: nothing bracketed or unrendered may survive.
    if (/[\[\]]|\{\{/.test(rendered) || /[\[\]]|\{\{/.test(ai.subject)) {
      return NextResponse.json({
        blocked: true,
        blockReasons: ["Generated draft contained an unfilled placeholder — regenerate."],
        provider: ai.provider,
      });
    }

    return NextResponse.json({
      subject: ai.subject,
      body: rendered,
      hook: ai.hook,
      reason: ai.reason,
      confidence: ai.confidence,
      provider: ai.provider,
      format,
      leadProject: leadProject.id,
      sentToday,
      dailyCap: DAILY_CAP,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
