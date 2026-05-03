import { NextRequest } from "next/server";
import { listTemplates, migrateTemplatesIfNeeded, seedTemplatesIfEmpty, upsertTemplate } from "@/lib/jobApp";
import { bad, ok, requireUser } from "../_helpers";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  await seedTemplatesIfEmpty(auth.email);
  await migrateTemplatesIfNeeded(auth.email);
  return ok({ templates: await listTemplates(auth.email) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || !body.name || !body.subject || !body.body) {
    return bad("name, subject, and body are required");
  }
  const t = await upsertTemplate(auth.email, body);
  return ok({ template: t });
}
