import { NextRequest } from "next/server";
import { saveSmtp, saveGoogle, getSettingsView } from "@/lib/settings";
import { ok, requireUser } from "@/app/api/jobs/_helpers";

// POST — one-time migration of a user's legacy browser-stored credentials into
// their synced account settings. The client calls this once after the update so
// existing SMTP config / Google connection carry over without re-setup.
// Body: { smtp?: {host,port,user,pass,security}, google?: {email,name,refreshToken} }
// Existing server settings are NOT overwritten (server is already source of truth).
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: {
    smtp?: { host?: string; port?: string; user?: string; pass?: string; security?: string };
    google?: { email?: string; name?: string; refreshToken?: string };
  };
  try {
    body = await req.json();
  } catch {
    return ok({ migrated: false });
  }

  const current = await getSettingsView(auth.email);
  let migratedSmtp = false;
  let migratedGoogle = false;

  if (!current.smtp && body.smtp?.user && body.smtp?.pass) {
    await saveSmtp(auth.email, {
      host: body.smtp.host || "smtp.gmail.com",
      port: body.smtp.port || "587",
      user: body.smtp.user,
      pass: body.smtp.pass,
      security: body.smtp.security || "starttls",
    });
    migratedSmtp = true;
  }

  if (!current.google && body.google?.email && body.google?.refreshToken) {
    await saveGoogle(auth.email, {
      email: body.google.email,
      name: body.google.name || "",
      refreshToken: body.google.refreshToken,
    });
    migratedGoogle = true;
  }

  return ok({ migrated: migratedSmtp || migratedGoogle, migratedSmtp, migratedGoogle });
}
