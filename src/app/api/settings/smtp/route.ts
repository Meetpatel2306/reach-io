import { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { saveSmtp, clearSmtp } from "@/lib/settings";
import { ok, bad, requireUser } from "@/app/api/jobs/_helpers";

// POST — verify SMTP credentials, then store them (encrypted) on the user's
// account so they sync across devices. Body: { smtpHost, smtpPort, smtpUser,
// smtpPass, smtpSecurity, save?: boolean }. When save is false we only test.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: Record<string, string | boolean>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body");
  }

  const smtpHost = ((body.smtpHost as string) || "smtp.gmail.com").trim();
  const smtpPort = ((body.smtpPort as string) || "587").trim();
  const smtpUser = ((body.smtpUser as string) || "").trim();
  const smtpPass = ((body.smtpPass as string) || "").trim();
  const smtpSecurity = ((body.smtpSecurity as string) || "starttls").trim();
  const persist = body.save !== false; // default: verify AND save

  if (!smtpUser || !smtpPass) return bad("Email and app password are required");

  const isGmail = smtpHost.includes("gmail");
  try {
    const transporter = nodemailer.createTransport(
      isGmail
        ? { service: "gmail", auth: { user: smtpUser, pass: smtpPass } }
        : { host: smtpHost, port: parseInt(smtpPort), secure: smtpSecurity === "ssl", auth: { user: smtpUser, pass: smtpPass } },
    );
    await transporter.verify();
  } catch (err: unknown) {
    return bad(err instanceof Error ? err.message : "Connection failed");
  }

  if (persist) {
    await saveSmtp(auth.email, { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass, security: smtpSecurity });
  }
  return ok({ success: true, saved: persist });
}

// DELETE — remove stored SMTP config for this user.
export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  await clearSmtp(auth.email);
  return ok({ success: true });
}
