import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { kvSet } from "@/lib/storage";
import { getGoogleForSend, getSmtpForSend } from "@/lib/settings";
import { getGoogleAccessToken } from "@/lib/google";
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

// Build a raw RFC 822 email message for Gmail API. Body is base64-encoded so any
// UTF-8 content (accents, emoji, non-Latin names) survives intact.
function buildRawMessage(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachment?: { filename: string; content: Buffer } | null;
}): string {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
  ];

  const bodyB64 = Buffer.from(opts.body, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
  const textPart = [
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    bodyB64,
  ];

  let message: string;
  if (opts.attachment) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const fileB64 = opts.attachment.content.toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
    const filePart = [
      `--${boundary}`,
      `Content-Type: application/octet-stream; name="${opts.attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${opts.attachment.filename}"`,
      "",
      fileB64,
    ].join("\r\n");
    message = [
      headers.join("\r\n"),
      "",
      [`--${boundary}`, ...textPart].join("\r\n"),
      filePart,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: base64");
    message = [headers.join("\r\n"), "", bodyB64].join("\r\n");
  }

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendViaGmailApi(
  accessToken: string,
  fromEmail: string,
  recipient: Recipient,
  subject: string,
  body: string,
  attachment: { filename: string; content: Buffer } | null,
): Promise<void> {
  const raw = buildRawMessage({ from: fromEmail, to: recipient.email, subject, body, attachment });

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 403 && (errText.includes("insufficient") || errText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"))) {
      throw new Error("INSUFFICIENT_SCOPE: gmail.send permission was not granted. Reconnect Google and allow 'Send email on your behalf'.");
    }
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED: Google token expired or revoked. Reconnect Google in Settings.");
    }
    throw new Error(`Gmail API: ${res.status} ${errText.slice(0, 200)}`);
  }
}

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

    // --- Resolve the sending method from the user's synced server settings ---
    // Prefer Google; if the Google token can't be refreshed, fall back to SMTP.
    const googleCfg = await getGoogleForSend(userEmail);
    const smtpCfg = await getSmtpForSend(userEmail);

    let method: "oauth" | "smtp" | null = null;
    let accessToken: string | null = null;
    let fromAddress = "";
    let transporter: nodemailer.Transporter | null = null;
    let googleExpired = false;
    let smtpError = "";

    if (googleCfg) {
      accessToken = await getGoogleAccessToken(googleCfg.refreshToken);
      if (accessToken) {
        method = "oauth";
        fromAddress = googleCfg.email;
      } else {
        googleExpired = true; // token dead — will try SMTP fallback below
      }
    }

    if (!method && smtpCfg) {
      try {
        const isGmail = smtpCfg.host.includes("gmail");
        transporter = nodemailer.createTransport(
          isGmail
            ? { service: "gmail", auth: { user: smtpCfg.user, pass: smtpCfg.pass } }
            : { host: smtpCfg.host, port: parseInt(smtpCfg.port), secure: smtpCfg.security === "ssl", auth: { user: smtpCfg.user, pass: smtpCfg.pass } },
        );
        await transporter.verify();
        method = "smtp";
        fromAddress = smtpCfg.user;
      } catch (err: unknown) {
        smtpError = err instanceof Error ? err.message : "SMTP connection failed";
        transporter = null;
      }
    }

    if (!method) {
      let error: string;
      if (googleExpired) {
        error = smtpCfg
          ? `Google connection expired and SMTP failed (${smtpError}). Reconnect Google in Settings.`
          : "Your Google connection has expired. Reconnect Google in Settings — or add an SMTP app password as a backup.";
      } else if (smtpError) {
        error = `SMTP connection failed: ${smtpError}`;
      } else {
        error = "No sending method configured. Connect Google or add an SMTP app password in Settings.";
      }
      return NextResponse.json({ error }, { status: 400 });
    }

    const attachment = resumeBuffer ? { filename: resumeName, content: resumeBuffer } : null;

    // Per-recipient placeholder render only when the template actually contains
    // placeholders — keeps the simple "same email to all" flow untouched.
    const personalize = HAS_PLACEHOLDER.test(subject) || HAS_PLACEHOLDER.test(body);

    const results: { email: string; status: string; error?: string }[] = [];
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const ctx = personalize ? buildContext(r) : null;
      const finalSubject = ctx ? renderPlaceholders(subject, ctx) : subject;
      const finalBody = ctx ? renderPlaceholders(body, ctx) : body;

      try {
        if (method === "oauth" && accessToken) {
          await sendViaGmailApi(accessToken, fromAddress, r, finalSubject, finalBody, attachment);
        } else if (transporter) {
          const mailOptions: nodemailer.SendMailOptions = {
            from: fromAddress,
            to: r.email,
            subject: finalSubject,
            text: finalBody,
          };
          if (attachment) mailOptions.attachments = [{ filename: attachment.filename, content: attachment.content }];
          await transporter.sendMail(mailOptions);
        }
        results.push({ email: r.email, status: "sent" });
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

      // Mirror per-recipient sends into job-mailer history in ONE write.
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
