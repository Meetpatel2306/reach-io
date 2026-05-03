import { NextRequest } from "next/server";
import { listContacts, upsertContact } from "@/lib/jobApp";
import { bad, ok, requireUser } from "../_helpers";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return ok({ contacts: await listContacts(auth.email) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || !body.email) return bad("email is required");
  const c = await upsertContact(auth.email, body);
  return ok({ contact: c });
}
