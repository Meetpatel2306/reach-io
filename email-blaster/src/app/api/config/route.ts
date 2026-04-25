import { NextResponse } from "next/server";

export async function GET() {
  // Config is now managed entirely in the browser (localStorage)
  // This endpoint only returns non-sensitive defaults
  return NextResponse.json({
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpSecurity: "starttls",
  });
}
