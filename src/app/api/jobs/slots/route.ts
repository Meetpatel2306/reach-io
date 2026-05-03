import { NextRequest } from "next/server";
import { listSlots, upsertSlot } from "@/lib/jobApp";
import { bad, ok, requireUser } from "../_helpers";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return ok({ slots: await listSlots(auth.email) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || !body.name || !body.subject || !body.body || !body.resumeBase64) {
    return bad("name, subject, body, and resumeBase64 are required");
  }
  const slot = await upsertSlot(auth.email, body);
  return ok({ slot });
}
