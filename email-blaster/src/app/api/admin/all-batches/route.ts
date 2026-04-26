import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kvGet, kvKeys } from "@/lib/storage";

interface ServerBatch {
  id: string;
  userEmail: string;
  userName: string;
  timestamp: string;
  subject: string;
  body: string;
  from: string;
  method: string;
  hasAttachment: boolean;
  attachmentName: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  results: { email: string; name: string; status: string; error?: string }[];
}

export async function GET() {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await kvKeys("batch:*");
  const batches = await Promise.all(keys.map((k) => kvGet<ServerBatch>(k)));
  const valid = batches.filter((b): b is ServerBatch => !!b);
  // Sort by timestamp descending (most recent first)
  valid.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ batches: valid });
}
