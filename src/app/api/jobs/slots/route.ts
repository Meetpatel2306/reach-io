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
  // Resume is optional now — slots can save a template-only bundle.
  if (!body || !body.name || !body.subject || !body.body) {
    return bad("name, subject, and body are required");
  }
  const slot = await upsertSlot(auth.email, body);
  return ok({ slot });
}
