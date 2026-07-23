import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { deleteJobResume, listJobResumes } from "@/lib/jobResumes";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await deleteJobResume(auth.email, id);
  const resumes = await listJobResumes(auth.email);
  return NextResponse.json({ resumes: resumes.map(({ base64: _b, ...meta }) => meta) });
}
