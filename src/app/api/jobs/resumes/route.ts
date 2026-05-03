import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { listResumes, newId, upsertResume } from "@/lib/jobApp";
import { bad, ok, requireUser } from "../_helpers";

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

async function ensureDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return ok({ resumes: await listResumes(auth.email) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const label = ((formData.get("label") as string) || "").trim();
  const roleType = ((formData.get("roleType") as string) || "").trim();
  if (!file || file.size === 0) return bad("file is required");
  if (!label) return bad("label is required");

  await ensureDir();
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const stored = `jobresume_${newId()}_${safeName}`;
  const target = path.join(UPLOADS_DIR, stored);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(target, bytes);

  const meta = await upsertResume(auth.email, {
    label,
    roleType,
    filename: file.name,
    storedFilename: stored,
    sizeBytes: bytes.length,
  });
  return ok({ resume: meta });
}
