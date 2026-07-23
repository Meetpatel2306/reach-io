import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireUser } from "@/app/api/jobs/_helpers";
import { listLeads, updateLead } from "@/lib/jobLeads";
import { renderRoleTemplateBody } from "@/lib/candidate";
import { resolveTransport, sendOne, type Attachment } from "@/lib/mailer";
import { appendHistory, listHistory, listResumes, listSlots, newId, nowIso, type SendRecord } from "@/lib/jobApp";
import { listJobResumes } from "@/lib/jobResumes";

export const maxDuration = 60;

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");
const DAILY_CAP = 20;

// NO AI here — plain keyword math, exactly as requested:
// anything AI-flavoured in the role/JD → AI positioning + AI resume (first
// priority); otherwise Python positioning + Python resume.
const AI_SIGNAL = /\b(ai|ml|llm|genai|generative|agent|agentic|rag|nlp|data\s*scien\w*|machine\s*learning|deep\s*learning|artificial|intelligen\w*|prompt|langchain|computer\s*vision|pytorch|tensorflow)\b/i;
const AI_NAME = /\bai\b|artificial|\bml\b|machine/i;
const PY_NAME = /python|backend|fastapi/i;

// Resolve resume bytes, most durable source first: Job Finder resumes
// (base64 in KV), then managed resumes (disk, ephemeral on Vercel), then
// Quick Slots (base64 in KV). Matching is by name keywords.
async function pickResume(
  userEmail: string,
  wantAi: boolean,
): Promise<{ attachment: Attachment; label: string } | null> {
  const jfResumes = await listJobResumes(userEmail);
  const jfTag = (r: { name: string; filename: string }) => `${r.name} ${r.filename}`;
  const jfRanked = [
    ...jfResumes.filter((r) => (wantAi ? AI_NAME : PY_NAME).test(jfTag(r))),
    ...jfResumes.filter((r) => (wantAi ? PY_NAME : AI_NAME).test(jfTag(r))),
    ...jfResumes,
  ];
  for (const r of jfRanked) {
    try {
      const content = Buffer.from(r.base64, "base64");
      if (content.length > 0) return { attachment: { filename: r.filename, content }, label: r.name };
    } catch {}
  }

  const resumes = await listResumes(userEmail);
  const tagOf = (r: { label: string; roleType: string; filename: string }) => `${r.label} ${r.roleType} ${r.filename}`;
  const ranked = [
    ...resumes.filter((r) => (wantAi ? AI_NAME : PY_NAME).test(tagOf(r))),
    ...resumes.filter((r) => (wantAi ? PY_NAME : AI_NAME).test(tagOf(r))),
    ...resumes,
  ];
  for (const r of ranked) {
    try {
      const content = await fs.readFile(path.join(UPLOADS_DIR, r.storedFilename));
      if (content.length > 0) return { attachment: { filename: r.filename, content }, label: r.label };
    } catch {}
  }

  const slots = await listSlots(userEmail);
  const withResume = slots.filter((s) => s.resumeBase64 && s.resumeName);
  const slotTag = (s: { name: string; resumeName: string }) => `${s.name} ${s.resumeName}`;
  const rankedSlots = [
    ...withResume.filter((s) => (wantAi ? AI_NAME : PY_NAME).test(slotTag(s))),
    ...withResume.filter((s) => (wantAi ? PY_NAME : AI_NAME).test(slotTag(s))),
    ...withResume,
  ];
  for (const s of rankedSlots) {
    try {
      const b64 = s.resumeBase64.includes(",") ? s.resumeBase64.split(",")[1] : s.resumeBase64;
      const content = Buffer.from(b64, "base64");
      if (content.length > 0) return { attachment: { filename: s.resumeName, content }, label: s.name };
    } catch {}
  }
  return null;
}

// POST /api/job-search/send  { id } — one click: build the email from the
// job's role/JD (deterministic template, no AI), attach the matching resume,
// send it, log it to history (so follow-ups work), and mark the lead Applied.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "");
    const lead = (await listLeads(auth.email)).find((l) => l.id === id);
    if (!lead) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const to = lead.contactEmail.trim().toLowerCase();
    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { error: "This job has no contact email. Click ✏️ Edit and add one, then try again." },
        { status: 400 },
      );
    }

    // Guards: never double-email a person; respect the daily cap.
    const history = await listHistory(auth.email);
    const sentOnly = history.filter((r) => r.status === "sent");
    if (sentOnly.some((r) => r.contactEmail.toLowerCase() === to)) {
      return NextResponse.json({ error: `You already emailed ${to}. Check Follow-ups instead of re-pitching.` }, { status: 400 });
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sentToday = sentOnly.filter((r) => new Date(r.sentAt) >= todayStart).length;
    if (sentToday >= DAILY_CAP) {
      return NextResponse.json({ error: `Daily cap reached (${sentToday}/${DAILY_CAP}). Continue tomorrow.` }, { status: 400 });
    }

    // Deterministic positioning from the job's own text.
    const jobText = `${lead.role} ${lead.jd} ${lead.query}`;
    const wantAi = AI_SIGNAL.test(jobText);
    const format = wantAi ? "ai" as const : "backend" as const;
    const subject = wantAi
      ? "AI Engineer — production LLM agent over 30+ tools"
      : "Python/FastAPI engineer — Kafka→ClickHouse at sub-5s latency";
    const emailBody = renderRoleTemplateBody(format, { recipientEmail: to, hook: "" });

    const resume = await pickResume(auth.email, wantAi);
    if (!resume) {
      return NextResponse.json(
        { error: "No stored resume found. Upload your resume once (Resume step or a Quick Slot) and retry." },
        { status: 400 },
      );
    }

    const transport = await resolveTransport(auth.email);
    if (transport.method === null) {
      return NextResponse.json({ error: transport.error }, { status: 400 });
    }

    const info = await sendOne(transport, { to, subject, body: emailBody, attachment: resume.attachment });

    const record: SendRecord = {
      id: newId(),
      status: "sent",
      sentAt: nowIso(),
      contactId: "",
      contactEmail: to,
      contactName: "",
      company: lead.company,
      role: lead.role,
      templateId: "",
      templateName: `Job Finder quick-send (${format})`,
      resumeId: null,
      resumeLabel: resume.attachment.filename,
      subject,
      body: emailBody,
      isFollowUp: false,
      followUpDone: false,
      ...(info.messageId ? { messageId: info.messageId } : {}),
      ...(info.threadId ? { threadId: info.threadId } : {}),
    };
    await appendHistory(auth.email, record);
    const updated = await updateLead(auth.email, id, { status: "applied" });

    return NextResponse.json({
      sent: true,
      to,
      subject,
      format,
      resumeUsed: resume.attachment.filename,
      lead: updated,
      message: `Sent to ${to} with ${resume.attachment.filename} (${wantAi ? "AI" : "Python"} positioning). Logged to History — follow-up tracking is on.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
