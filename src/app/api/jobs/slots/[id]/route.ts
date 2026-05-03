import { NextRequest } from "next/server";
import { deleteSlot, upsertSlot } from "@/lib/jobApp";
import { ok, requireUser } from "../../_helpers";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const patch = await req.json().catch(() => ({}));
  const slot = await upsertSlot(auth.email, { ...patch, id });
  return ok({ slot });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await deleteSlot(auth.email, id);
  return ok({ success: true });
}
