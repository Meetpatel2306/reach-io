import { NextResponse } from "next/server";

export async function GET() {
  const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  return NextResponse.json({
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: configured ? process.env.SMTP_USER : "",
    smtpSecurity: process.env.SMTP_SECURITY || "starttls",
    configured,
  });
}
