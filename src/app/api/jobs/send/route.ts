import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import {
  appendHistory,
  buildContext,
  getContact,
  getResume,
  getTemplate,
  newId,
  nowIso,
  render,
  type SendRecord,
} from "@/lib/jobApp";
import { requireUser } from "../_helpers";

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

interface SendBody {
  templateId: string;
  contactIds?: string[];
  resumeId?: string | null;
  isFollowUp?: boolean;
  // SMTP credentials (mirrors /api/send-email so we don't need to store passwords)
  smtpUser?: string;
  smtpPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: string;
  // OAuth (Gmail API) — preferred when present
  oauthAccessToken?: string;
  oauthEmail?: string;
}

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
    const textPart = [`--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 7bit", "", opts.body].join("\r\n");
    const fileB64 = opts.attachment.content.toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
    const filePart = [
      `--${boundary}`,
      `Content-Type: application/pdf; name="${opts.attachment.filename}"`,
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
  return Buffer.from(bodyText).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendViaGmailApi(token: string, from: string, to: string, subject: string, body: string, attachment: { filename: string; content: Buffer } | null) {
  const raw = buildRawMessage({ from, to, subject, body, attachment });
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 401) throw new Error("Google token expired. Sign out and sign in again.");
    if (res.status === 403 && (txt.includes("insufficient") || txt.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"))) {
      throw new Error("Missing gmail.send scope. Sign in with Google again and allow 'Send email on your behalf'.");
    }
    throw new Error(`Gmail API ${res.status}: ${txt.slice(0, 200)}`);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userEmail = auth.email;

  const data: SendBody = await req.json().catch(() => ({}));
  if (!data.templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  const contactIds = Array.isArray(data.contactIds) ? data.contactIds : [];
  if (!contactIds.length) return NextResponse.json({ error: "contactIds is required" }, { status: 400 });

  const template = await getTemplate(userEmail, data.templateId);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const resume = data.resumeId ? await getResume(userEmail, data.resumeId) : null;
  let attachment: { filename: string; content: Buffer } | null = null;
  if (resume) {
    try {
      const buf = await fs.readFile(path.join(UPLOADS_DIR, resume.storedFilename));
      attachment = { filename: resume.filename, content: buf };
    } catch {
      return NextResponse.json({ error: "Resume file missing on disk — re-upload it." }, { status: 400 });
    }
  }

  const useOAuth = !!(data.oauthAccessToken && data.oauthEmail);
  const useSmtp = !useOAuth && !!(data.smtpUser && data.smtpPass);
  if (!useOAuth && !useSmtp) {
    return NextResponse.json({ error: "No credentials. Sign in with Google or pass SMTP credentials." }, { status: 400 });
  }

  let transporter: nodemailer.Transporter | null = null;
  if (useSmtp) {
    const isGmail = (data.smtpHost || "smtp.gmail.com").includes("gmail");
    transporter = nodemailer.createTransport(
      isGmail
        ? { service: "gmail", auth: { user: data.smtpUser!, pass: data.smtpPass! } }
        : {
            host: data.smtpHost || "smtp.gmail.com",
            port: data.smtpPort || 587,
            secure: (data.smtpSecurity || "starttls") === "ssl",
            auth: { user: data.smtpUser!, pass: data.smtpPass! },
          }
    );
    await transporter.verify();
  }

  const fromAddress = useOAuth ? data.oauthEmail! : data.smtpUser!;
  const results: { contactId: string; email: string; status: "sent" | "failed"; error?: string; recordId: string }[] = [];

  for (const cid of contactIds) {
    const contact = await getContact(userEmail, cid);
    if (!contact) {
      results.push({ contactId: cid, email: "", status: "failed", error: "Contact not found", recordId: "" });
      continue;
    }
    const ctx = buildContext(contact);
    const subject = render(template.subject, ctx);
    const body = render(template.body, ctx);
    const recordId = newId();
    let status: "sent" | "failed" = "sent";
    let errorMsg: string | undefined;
    try {
      if (useOAuth) {
        await sendViaGmailApi(data.oauthAccessToken!, fromAddress, contact.email, subject, body, attachment);
      } else if (transporter) {
        await transporter.sendMail({
          from: fromAddress,
          to: contact.email,
          subject,
          text: body,
          ...(attachment ? { attachments: [{ filename: attachment.filename, content: attachment.content }] } : {}),
        });
      }
    } catch (err) {
      status = "failed";
      errorMsg = err instanceof Error ? err.message : "Unknown error";
    }

    const record: SendRecord = {
      id: recordId,
      status,
      sentAt: nowIso(),
      contactId: contact.id,
      contactEmail: contact.email,
      contactName: contact.name,
      company: contact.company,
      role: contact.role,
      templateId: template.id,
      templateName: template.name,
      resumeId: resume?.id || null,
      resumeLabel: resume?.label || "",
      subject,
      body,
      isFollowUp: !!data.isFollowUp,
      followUpDone: false,
      ...(errorMsg ? { error: errorMsg } : {}),
    };
    await appendHistory(userEmail, record);
    results.push({ contactId: cid, email: contact.email, status, ...(errorMsg ? { error: errorMsg } : {}), recordId });
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.length - sent;
  return NextResponse.json({ sent, failed, total: results.length, results });
}
