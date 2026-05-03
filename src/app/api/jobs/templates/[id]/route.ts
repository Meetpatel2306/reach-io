import { NextRequest } from "next/server";
import { deleteTemplate, getTemplate, upsertTemplate } from "@/lib/jobApp";
import { bad, ok, requireUser } from "../../_helpers";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const t = await getTemplate(auth.email, id);
  if (!t) return bad("Not found", 404);
  return ok({ template: t });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const patch = await req.json().catch(() => ({}));
  const t = await upsertTemplate(auth.email, { ...patch, id });
  return ok({ template: t });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await deleteTemplate(auth.email, id);
  return ok({ success: true });
}
