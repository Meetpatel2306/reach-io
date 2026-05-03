import { listHistory } from "@/lib/jobApp";
import { ok, requireUser } from "../_helpers";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const history = await listHistory(auth.email);
  history.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  return ok({ history });
}
