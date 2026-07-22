// Server-only shared mail transport for the send + follow-up routes.
// Resolves the user's synced credentials (Google OAuth preferred, SMTP fallback)
// and sends a single message, with optional RFC-2822 threading headers so a
// follow-up lands inside the original Gmail thread instead of as a new email.

import nodemailer from "nodemailer";
import { getGoogleForSend, getSmtpForSend } from "./settings";
import { getGoogleAccessToken } from "./google";

export interface Attachment {
  filename: string;
  content: Buffer;
}

export interface Threading {
  // RFC-2822 Message-ID of the message being replied to, e.g. "<abc@gmail.com>"
  inReplyTo?: string;
  references?: string;
  // Gmail API thread id — puts the follow-up in the same thread on the sender side.
  threadId?: string;
}

export interface SentInfo {
  messageId: string; // RFC-2822 Message-ID of the message we sent (with <>)
  threadId?: string; // Gmail thread id (oauth sends only)
}

export interface Transport {
  method: "oauth" | "smtp";
  fromAddress: string;
  accessToken?: string;
  transporter?: nodemailer.Transporter;
}

export interface TransportError {
  method: null;
  error: string;
}

// Generate our own Message-ID so we can store it and thread follow-ups later,
// regardless of transport.
export function newMessageId(fromAddress: string): string {
  const domain = fromAddress.includes("@") ? fromAddress.split("@")[1] : "reach.io";
  return `<eb.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}@${domain}>`;
}

// Resolve the user's sending method from synced server settings.
export async function resolveTransport(userEmail: string): Promise<Transport | TransportError> {
  const googleCfg = await getGoogleForSend(userEmail);
  const smtpCfg = await getSmtpForSend(userEmail);

  let googleExpired = false;
  let smtpError = "";

  if (googleCfg) {
    const accessToken = await getGoogleAccessToken(googleCfg.refreshToken);
    if (accessToken) {
      return { method: "oauth", fromAddress: googleCfg.email, accessToken };
    }
    googleExpired = true;
  }

  if (smtpCfg) {
    try {
      const isGmail = smtpCfg.host.includes("gmail");
      const transporter = nodemailer.createTransport(
        isGmail
          ? { service: "gmail", auth: { user: smtpCfg.user, pass: smtpCfg.pass } }
          : { host: smtpCfg.host, port: parseInt(smtpCfg.port), secure: smtpCfg.security === "ssl", auth: { user: smtpCfg.user, pass: smtpCfg.pass } },
      );
      await transporter.verify();
      return { method: "smtp", fromAddress: smtpCfg.user, transporter };
    } catch (err: unknown) {
      smtpError = err instanceof Error ? err.message : "SMTP connection failed";
    }
  }

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
  return { method: null, error };
}

// Build a raw RFC 822 email message for Gmail API. Body is base64-encoded so any
// UTF-8 content (accents, emoji, non-Latin names) survives intact.
export function buildRawMessage(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  messageId: string;
  attachment?: Attachment | null;
  threading?: Threading;
}): string {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`,
    `Message-ID: ${opts.messageId}`,
    "MIME-Version: 1.0",
  ];
  if (opts.threading?.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.threading.inReplyTo}`);
    headers.push(`References: ${opts.threading.references || opts.threading.inReplyTo}`);
  }

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
  raw: string,
  threadId?: string,
): Promise<{ threadId?: string }> {
  const payload: { raw: string; threadId?: string } = { raw };
  if (threadId) payload.threadId = threadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
  const data = await res.json().catch(() => ({}));
  return { threadId: data.threadId };
}

// Send one message through an already-resolved transport. Returns the
// Message-ID we stamped on it (+ Gmail threadId when available).
export async function sendOne(
  transport: Transport,
  opts: {
    to: string;
    subject: string;
    body: string;
    attachment?: Attachment | null;
    threading?: Threading;
  },
): Promise<SentInfo> {
  const messageId = newMessageId(transport.fromAddress);

  if (transport.method === "oauth" && transport.accessToken) {
    const raw = buildRawMessage({
      from: transport.fromAddress,
      to: opts.to,
      subject: opts.subject,
      body: opts.body,
      messageId,
      attachment: opts.attachment,
      threading: opts.threading,
    });
    const { threadId } = await sendViaGmailApi(transport.accessToken, raw, opts.threading?.threadId);
    return { messageId, threadId };
  }

  if (transport.transporter) {
    const mailOptions: nodemailer.SendMailOptions = {
      from: transport.fromAddress,
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
      messageId,
    };
    if (opts.threading?.inReplyTo) {
      mailOptions.inReplyTo = opts.threading.inReplyTo;
      mailOptions.references = opts.threading.references || opts.threading.inReplyTo;
    }
    if (opts.attachment) mailOptions.attachments = [{ filename: opts.attachment.filename, content: opts.attachment.content }];
    await transport.transporter.sendMail(mailOptions);
    return { messageId };
  }

  throw new Error("No usable transport");
}
