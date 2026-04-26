import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { kvSet } from "@/lib/storage";

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

interface Recipient { name: string; email: string; }

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

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];

      try {
        if (useOAuth) {
          await sendViaGmailApi(oauthAccessToken, fromAddress, r, subject, body, attachment);
        } else if (transporter) {
          const mailOptions: nodemailer.SendMailOptions = {
            from: fromAddress,
            to: r.email,
            subject,
            text: body,
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
    try {
      const session = await getSession();
      const userEmail = session.email || "anonymous";
      const userName = session.name || "";
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      };
      // Store under both keys for fast lookup
      await kvSet(`batch:${batchId}`, batch);
      await kvSet(`userbatch:${userEmail}:${batchId}`, batchId);
    } catch {
      // Don't fail the response if storage fails
    }

    return NextResponse.json({ sent, failed, total: recipients.length, results, method: useOAuth ? "oauth" : "smtp" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
