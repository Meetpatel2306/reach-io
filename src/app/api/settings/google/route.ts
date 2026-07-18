import { clearGoogle } from "@/lib/settings";
import { ok, requireUser } from "@/app/api/jobs/_helpers";

// DELETE — disconnect the stored Google account for this user.
export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  await clearGoogle(auth.email);
  return ok({ success: true });
}
