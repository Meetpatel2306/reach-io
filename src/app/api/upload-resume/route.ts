import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");

export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get("name") || "";
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return NextResponse.json({ error: "invalid name" }, { status: 400 });
  }
  try {
    const buffer = await fs.readFile(path.join(UPLOADS_DIR, name));
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const formData = await req.formData();
    const file = formData.get("resume") as File;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `resume_${Date.now()}_${file.name}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(filepath, buffer);

    return NextResponse.json({ success: true, filename, filepath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
