import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { deleteLead, updateLead, type JobLead } from "@/lib/jobLeads";

// PATCH /api/job-search/leads/[id] — inline edits from the table (any field).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const patch = (await req.json().catch(() => ({}))) as Partial<JobLead>;
  const updated = await updateLead(auth.email, id, patch);
  if (!updated) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await deleteLead(auth.email, id);
  return NextResponse.json({ ok: true });
}
