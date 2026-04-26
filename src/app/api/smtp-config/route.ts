import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// POST - test SMTP connection (validates credentials without saving server-side)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecurity } = body;

    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const host = smtpHost || "smtp.gmail.com";
    const port = parseInt(smtpPort || "587");
    const isGmail = host.includes("gmail");

    const transporter = nodemailer.createTransport(
      isGmail
        ? { service: "gmail", auth: { user: smtpUser, pass: smtpPass } }
        : { host, port, secure: smtpSecurity === "ssl", auth: { user: smtpUser, pass: smtpPass } }
    );

    await transporter.verify();

    return NextResponse.json({ success: true, message: "Connection verified!" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET - return env-based config status (no secrets exposed)
export async function GET() {
  const fromEnv = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  return NextResponse.json({
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: fromEnv ? process.env.SMTP_USER : "",
    smtpSecurity: process.env.SMTP_SECURITY || "starttls",
    configured: fromEnv,
  });
}
