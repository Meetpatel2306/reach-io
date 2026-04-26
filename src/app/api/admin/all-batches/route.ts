import { NextRequest, NextResponse } from "next/server";
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

const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200"), MAX_LIMIT);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

  const keys = await kvKeys("batch:*");
  // Fetch only what's needed (paginate at fetch level for large datasets)
  const batches = await Promise.all(keys.map((k) => kvGet<ServerBatch>(k)));
  const valid = batches.filter((b): b is ServerBatch => !!b);
  valid.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = valid.length;
  const paged = valid.slice(offset, offset + limit);

  return NextResponse.json({
    batches: paged,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  });
}
