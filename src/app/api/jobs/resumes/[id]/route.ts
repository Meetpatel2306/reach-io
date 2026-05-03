import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { deleteResume, getResume } from "@/lib/jobApp";
import { ok, requireUser } from "../../_helpers";

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const meta = await getResume(auth.email, id);
  if (meta?.storedFilename) {
    await fs.unlink(path.join(UPLOADS_DIR, meta.storedFilename)).catch(() => {});
  }
  await deleteResume(auth.email, id);
  return ok({ success: true });
}
