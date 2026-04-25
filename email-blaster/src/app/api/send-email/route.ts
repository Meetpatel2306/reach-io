import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // SMTP credentials: must come from the request (sent by client from localStorage)
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

    // Load resume: try direct upload first, then stored file
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
      } catch {
        // Resume file not found on disk
      }
    }

    const recipients: { name: string; email: string }[] = JSON.parse(recipientsJson);

    if (!recipients.length) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }
    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: "SMTP credentials missing. Configure in Settings and try again." }, { status: 400 });
    }

    const isGmail = smtpHost.includes("gmail");
    const transporter = nodemailer.createTransport(
      isGmail
        ? { service: "gmail", auth: { user: smtpUser, pass: smtpPass } }
        : { host: smtpHost, port: smtpPort, secure: security === "ssl", auth: { user: smtpUser, pass: smtpPass } }
    );

    await transporter.verify();

    const results: { email: string; status: string; error?: string }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];

      try {
        const mailOptions: nodemailer.SendMailOptions = {
          from: smtpUser,
          to: r.email,
          subject,
          text: body,
        };

        if (resumeBuffer) {
          mailOptions.attachments = [
            { filename: resumeName, content: resumeBuffer },
          ];
        }

        await transporter.sendMail(mailOptions);
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

    return NextResponse.json({ sent, failed, total: recipients.length, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
