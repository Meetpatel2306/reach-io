import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { addJobResume, listJobResumes, MAX_RESUME_BYTES } from "@/lib/jobResumes";

// GET — list saved Job Finder resumes (metadata only, no bytes).
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const resumes = await listJobResumes(auth.email);
  return NextResponse.json({
    resumes: resumes.map(({ base64: _b, ...meta }) => meta),
  });
}

// POST multipart — upload one or more resume files, stored durably in KV.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const fd = await req.formData();
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return NextResponse.json({ error: "No files received" }, { status: 400 });

    const added: string[] = [];
    for (const f of files) {
      if (f.size > MAX_RESUME_BYTES) {
        return NextResponse.json(
          { error: `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)} MB — keep resumes under 1.5 MB.` },
          { status: 400 },
        );
      }
      const base64 = Buffer.from(await f.arrayBuffer()).toString("base64");
      await addJobResume(auth.email, {
        name: f.name.replace(/\.pdf$/i, ""),
        filename: f.name,
        base64,
        sizeBytes: f.size,
      });
      added.push(f.name);
    }

    const resumes = await listJobResumes(auth.email);
    return NextResponse.json({
      added,
      resumes: resumes.map(({ base64: _b, ...meta }) => meta),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
