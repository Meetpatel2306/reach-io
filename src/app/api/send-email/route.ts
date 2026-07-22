import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { kvSet } from "@/lib/storage";
import { resolveTransport, sendOne, type SentInfo } from "@/lib/mailer";
import { buildContext, render as renderPlaceholders } from "@/lib/jobAppShared";
import { appendHistoryMany, newId, nowIso, type SendRecord } from "@/lib/jobApp";
import { requireUser } from "@/app/api/jobs/_helpers";

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

interface Recipient {
  name: string;
  email: string;
  // Optional fields for {company}/{role}/{custom1}/{custom2} placeholder rendering.
  company?: string;
  role?: string;
  custom1?: string;
  custom2?: string;
}

const HAS_PLACEHOLDER = /\{(first_name|name|company|role|custom1|custom2)\}/;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const userEmail = auth.email;

    const formData = await req.formData();

    const recipientsJson = formData.get("recipients") as string;
    const subject = (formData.get("subject") as string) || "";
    const body = (formData.get("body") as string) || "";
    const minDelay = parseInt((formData.get("minDelay") as string) || "2") * 1000;
    const maxDelay = parseInt((formData.get("maxDelay") as string) || "5") * 1000;
    const resumeFilename = formData.get("resumeFilename") as string | null;
    const resumeFileDirect = formData.get("resumeFile") as File | null;

    // Resume bytes — prefer bytes sent directly by the client (reliable), fall
    // back to a previously-uploaded file on disk (legacy; ephemeral on Vercel).
    let resumeBuffer: Buffer | null = null;
    let resumeName = "";
    if (resumeFileDirect && resumeFileDirect.size > 0) {
      resumeBuffer = Buffer.from(await resumeFileDirect.arrayBuffer());
      resumeName = resumeFileDirect.name;
    } else if (resumeFilename) {
      try {
        resumeBuffer = await fs.readFile(path.join(UPLOADS_DIR, resumeFilename));
        resumeName = resumeFilename.replace(/^resume_\d+_/, "");
      } catch {}
    }

    let recipients: Recipient[];
    try {
      recipients = JSON.parse(recipientsJson);
    } catch {
      return NextResponse.json({ error: "Invalid recipients" }, { status: 400 });
    }
    if (!recipients.length) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }

    // Credentials are resolved server-side from the user's synced settings —
    // Google OAuth preferred, SMTP app-password fallback.
    const transport = await resolveTransport(userEmail);
    if (transport.method === null) {
      return NextResponse.json({ error: transport.error }, { status: 400 });
    }
    const { method, fromAddress } = transport;

    const attachment = resumeBuffer ? { filename: resumeName, content: resumeBuffer } : null;

    // Per-recipient placeholder render only when the template actually contains
    // placeholders — keeps the simple "same email to all" flow untouched.
    const personalize = HAS_PLACEHOLDER.test(subject) || HAS_PLACEHOLDER.test(body);

    const results: { email: string; status: string; error?: string; messageId?: string; threadId?: string }[] = [];
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const ctx = personalize ? buildContext(r) : null;
      const finalSubject = ctx ? renderPlaceholders(subject, ctx) : subject;
      const finalBody = ctx ? renderPlaceholders(body, ctx) : body;

      try {
        const info: SentInfo = await sendOne(transport, {
          to: r.email,
          subject: finalSubject,
          body: finalBody,
          attachment,
        });
        results.push({ email: r.email, status: "sent", messageId: info.messageId, threadId: info.threadId });
      } catch (err: unknown) {
        results.push({ email: r.email, status: "failed", error: err instanceof Error ? err.message : "Unknown error" });
      }

      if (i < recipients.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    // Persist the batch server-side (admin visibility + cross-device history).
    let savedBatchId: string | null = null;
    try {
      const session = await getSession();
      const userName = session.name || "";
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      savedBatchId = batchId;
      const batch = {
        id: batchId,
        userEmail,
        userName,
        timestamp: new Date().toISOString(),
        subject,
        body,
        from: fromAddress,
        method,
        hasAttachment: !!resumeBuffer,
        attachmentName: resumeBuffer ? resumeName : "",
        totalRecipients: recipients.length,
        sent,
        failed,
        results: results.map((r) => {
          const recipient = recipients.find((rec) => rec.email === r.email);
          return { email: r.email, name: recipient?.name || "", status: r.status, error: r.error };
        }),
        deletedByUser: false,
      };
      await kvSet(`batch:${batchId}`, batch);
      await kvSet(`userbatch:${userEmail}:${batchId}`, batchId);

      // Mirror per-recipient sends into job-mailer history in ONE write. The
      // Message-ID / thread id is what lets the follow-up reply in-thread later.
      const sentAt = nowIso();
      const records: SendRecord[] = results.map((r) => {
        const recipient = recipients.find((rec) => rec.email === r.email);
        return {
          id: newId(),
          status: r.status as "sent" | "failed",
          sentAt,
          contactId: "",
          contactEmail: r.email,
          contactName: recipient?.name || "",
          company: recipient?.company || "",
          role: recipient?.role || "",
          templateId: "",
          templateName: "",
          resumeId: null,
          resumeLabel: resumeBuffer ? resumeName : "",
          subject,
          body,
          isFollowUp: false,
          followUpDone: false,
          ...(r.messageId ? { messageId: r.messageId } : {}),
          ...(r.threadId ? { threadId: r.threadId } : {}),
          ...(r.error ? { error: r.error } : {}),
        };
      });
      await appendHistoryMany(userEmail, records);
    } catch {}

    return NextResponse.json({ sent, failed, total: recipients.length, results, method, batchId: savedBatchId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
