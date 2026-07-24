import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireUser } from "@/app/api/jobs/_helpers";
import { generatePersonalization } from "@/lib/ai";
import { getAiKeysForUse } from "@/lib/settings";
import { GENERIC_INBOX, getProject, pickFormatForProject, renderOutreachBody, renderRoleTemplateBody } from "@/lib/candidate";
import { listHistory } from "@/lib/jobApp";

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
const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

// Extract plain text from the attached resume PDF so the AI can draw on the
// candidate's real resume. Best-effort: any failure just means "no resume text".
async function extractResumeText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    return (parsed.text || "").replace(/\s+\n/g, "\n").trim().slice(0, 6000);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Accept both multipart (with resume) and plain JSON (without).
    let body: Record<string, unknown> = {};
    let resumeText = "";
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) if (typeof v === "string") body[k] = v;
      const resumeFile = fd.get("resumeFile") as File | null;
      const resumeFilename = fd.get("resumeFilename") as string | null;
      let buffer: Buffer | null = null;
      if (resumeFile && resumeFile.size > 0) {
        buffer = Buffer.from(await resumeFile.arrayBuffer());
      } else if (resumeFilename) {
        try { buffer = await fs.readFile(path.join(UPLOADS_DIR, resumeFilename)); } catch {}
      }
      if (buffer) resumeText = await extractResumeText(buffer);
    } else {
      body = await req.json().catch(() => ({}));
    }
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
    // JD is optional: with a real JD the AI writes a personalised hook; without
    // one we instantly render the matching template as-is (no hook, no AI call).
    const hasJd = jdText.length >= 80;

    // ---- Hard block rules (checked before spending an AI call) ----
    const blocks: string[] = [];
    const warnings: string[] = [];

    // Generic inboxes are a WARNING, not a block: job listings often publish
    // only an hr@/careers@ address, and pasted Job Finder leads use it.
    if (recipientEmail && GENERIC_INBOX.test(recipientEmail)) {
      warnings.push(
        `${recipientEmail} is a shared inbox (hr@/careers@...). It works, but response rates are much higher when you also find a real person on LinkedIn.`,
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

    // ---- No JD: instant template draft, no AI call ----
    if (!hasJd) {
      const roleLooksAi = /\b(ai|ml|machine|llm|genai|generative|agent|agentic|rag|nlp|data scien|deep|intelligen|prompt)\w*/i.test(roleTitle);
      const format: "ai" | "backend" | "fixed" =
        requestedFormat === "ai" || requestedFormat === "backend" || requestedFormat === "fixed"
          ? requestedFormat
          : roleLooksAi ? "ai" : "backend";
      const fmt = format === "fixed" ? (roleLooksAi ? "ai" : "backend") : format;
      const body = renderRoleTemplateBody(fmt, { recipientName, recipientEmail, hook: "" });
      const subject = fmt === "ai"
        ? "AI Engineer — production LLM agent over 30+ tools"
        : "Python/FastAPI engineer — Kafka→ClickHouse at sub-5s latency";
      const todaySent = sentToday;
      return NextResponse.json({
        subject,
        body,
        hook: "",
        reason: "No job description given, so this is your template as-is — paste the JD next time for a personalised opening line.",
        confidence: "high",
        provider: "template",
        format: fmt,
        resumeHint: fmt === "backend"
          ? "Attach your Python/Backend resume for this one."
          : "Attach your AI Engineer resume (Meet_Patel_AI_Engineer.pdf) for this one.",
        leadProject: fmt === "ai" ? "mcp_agent" : "alerting",
        sentToday: todaySent,
        dailyCap: DAILY_CAP,
        warnings: warnings.length ? warnings : undefined,
      });
    }

    // ---- AI call: Gemini primary, Groq fallback ----
    const aiKeys = await getAiKeysForUse(auth.email);
    const ai = await generatePersonalization({ company, recipientName, recipientTitle, roleTitle, jdText, resumeText }, aiKeys);

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

    // Auto format: trust the AI's role_type read of the JD; fall back to the
    // lead project's nature if it's ever missing.
    const format: "ai" | "backend" | "fixed" =
      requestedFormat === "ai" || requestedFormat === "backend" || requestedFormat === "fixed"
        ? requestedFormat
        : ai.role_type || pickFormatForProject(leadProject.id);

    const rendered = format === "fixed"
      ? renderOutreachBody({
          recipientName,
          recipientEmail,
          hook: ai.hook,
          leadProject,
          secondProject,
        })
      : renderRoleTemplateBody(format, { recipientName, recipientEmail, hook: ai.hook });

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
      resumeHint: format === "backend"
        ? "Attach your Python/Backend resume for this one."
        : "Attach your AI Engineer resume (Meet_Patel_AI_Engineer.pdf) for this one.",
      leadProject: leadProject.id,
      sentToday,
      dailyCap: DAILY_CAP,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
