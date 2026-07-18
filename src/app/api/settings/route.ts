import { getSettingsView } from "@/lib/settings";
import { ok, requireUser } from "@/app/api/jobs/_helpers";

// GET — redacted settings for the current user (no secrets). Used by the client
// to hydrate "SMTP configured?" / "Google connected?" state across devices.
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return ok(await getSettingsView(auth.email));
}
