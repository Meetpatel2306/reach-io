import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { kvSet } from "@/lib/storage";
import { buildContext, render as renderPlaceholders } from "@/lib/jobAppShared";
import { appendHistory, newId, nowIso } from "@/lib/jobApp";

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

// Build a raw RFC 822 email message for Gmail API
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

  let bodyText: string;
  if (opts.attachment) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const textPart = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      opts.body,
    ].join("\r\n");
    const fileB64 = opts.attachment.content.toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
    const filePart = [
      `--${boundary}`,
      `Content-Type: application/octet-stream; name="${opts.attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${opts.attachment.filename}"`,
      "",
      fileB64,
    ].join("\r\n");
    bodyText = [headers.join("\r\n"), "", textPart, filePart, `--${boundary}--`].join("\r\n");
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    bodyText = [headers.join("\r\n"), "", opts.body].join("\r\n");
  }

  return Buffer.from(bodyText)
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
  const raw = buildRawMessage({
    from: fromEmail,
    to: recipient.email,
    subject,
    body,
    attachment,
  });

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Detect missing-scope error so client can show a helpful message
    if (res.status === 403 && (errText.includes("insufficient") || errText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"))) {
      throw new Error("INSUFFICIENT_SCOPE: gmail.send permission was not granted. Sign out and sign in with Google again — make sure to allow 'Send email on your behalf'.");
    }
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED: Google token expired or revoked. Sign out and sign in again.");
    }
    throw new Error(`Gmail API: ${res.status} ${errText.slice(0, 200)}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // OAuth credentials (preferred path)
    const oauthAccessToken = ((formData.get("oauthAccessToken") as string) || "").trim();
    const oauthEmail = ((formData.get("oauthEmail") as string) || "").trim();

    // SMTP credentials (fallback path)
    const smtpHost = ((formData.get("smtpHost") as string) || "smtp.gmail.com").trim();
    const smtpPort = parseInt(((formData.get("smtpPort") as string) || "587").trim());
    const smtpUser = ((formData.get("smtpUser") as string) || "").trim();
    const smtpPass = ((formData.get("smtpPass") as string) || "").trim();
    const security = ((formData.get("smtpSecurity") as string) || "starttls").trim();

    const recipientsJson = formData.get("recipients") as string;
    const subject = formData.get("subject") as string;
    const body = formData.get("body") as string;
    const minDelay = parseInt((formData.get("minDelay") as string) || "2") * 1000;
    const maxDelay = parseInt((formData.get("maxDelay") as string) || "5") * 1000;
    const resumeFilename = formData.get("resumeFilename") as string | null;
    const resumeFileDirect = formData.get("resumeFile") as File | null;

    // Load resume
    let resumeBuffer: Buffer | null = null;
    let resumeName = "";
    if (resumeFileDirect && resumeFileDirect.size > 0) {
      resumeBuffer = Buffer.from(await resumeFileDirect.arrayBuffer());
      resumeName = resumeFileDirect.name;
    } else if (resumeFilename) {
      try {
        const resumePath = path.join(UPLOADS_DIR, resumeFilename);
        resumeBuffer = await fs.readFile(resumePath);
        resumeName = resumeFilename.replace(/^resume_\d+_/, "");
      } catch {}
    }

    const recipients: Recipient[] = JSON.parse(recipientsJson);

    if (!recipients.length) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }

    const useOAuth = !!(oauthAccessToken && oauthEmail);
    const useSmtp = !useOAuth && !!(smtpUser && smtpPass);

    if (!useOAuth && !useSmtp) {
      return NextResponse.json({ error: "No credentials. Sign in with Google or configure SMTP." }, { status: 400 });
    }

    // Set up SMTP transporter (only when using SMTP)
    let transporter: nodemailer.Transporter | null = null;
    if (useSmtp) {
      const isGmail = smtpHost.includes("gmail");
      transporter = nodemailer.createTransport(
        isGmail
          ? { service: "gmail", auth: { user: smtpUser, pass: smtpPass } }
          : { host: smtpHost, port: smtpPort, secure: security === "ssl", auth: { user: smtpUser, pass: smtpPass } }
      );
      await transporter.verify();
    }

    const results: { email: string; status: string; error?: string }[] = [];
    const fromAddress = useOAuth ? oauthEmail : smtpUser;
    const attachment = resumeBuffer ? { filename: resumeName, content: resumeBuffer } : null;

    // Per-recipient placeholder render is only invoked when the template actually
    // contains placeholders — keeps the simple "same email to all" flow untouched.
    const personalize = HAS_PLACEHOLDER.test(subject) || HAS_PLACEHOLDER.test(body);

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const ctx = personalize ? buildContext(r) : null;
      const finalSubject = ctx ? renderPlaceholders(subject, ctx) : subject;
      const finalBody = ctx ? renderPlaceholders(body, ctx) : body;

      try {
        if (useOAuth) {
          await sendViaGmailApi(oauthAccessToken, fromAddress, r, finalSubject, finalBody, attachment);
        } else if (transporter) {
          const mailOptions: nodemailer.SendMailOptions = {
            from: fromAddress,
            to: r.email,
            subject: finalSubject,
            text: finalBody,
          };
          if (attachment) {
            mailOptions.attachments = [{ filename: attachment.filename, content: attachment.content }];
          }
          await transporter.sendMail(mailOptions);
        }
        results.push({ email: r.email, status: "sent" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ email: r.email, status: "failed", error: message });
      }

      if (i < recipients.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    // Save batch to server-side KV with user attribution (so admin can see everything)
    let savedBatchId: string | null = null;
    try {
      const session = await getSession();
      const userEmail = session.email || "anonymous";
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
        method: useOAuth ? "oauth" : "smtp",
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

      // Mirror per-recipient sends into job-mailer history so follow-up tracking
      // works for everything sent through this endpoint, not just /jobs sends.
      if (userEmail !== "anonymous") {
        const sentAt = nowIso();
        for (const r of results) {
          const recipient = recipients.find((rec) => rec.email === r.email);
          await appendHistory(userEmail, {
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
          });
        }
      }
    } catch {}

    return NextResponse.json({ sent, failed, total: recipients.length, results, method: useOAuth ? "oauth" : "smtp", batchId: savedBatchId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
