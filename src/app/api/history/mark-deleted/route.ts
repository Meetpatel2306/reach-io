import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kvGet, kvSet, kvKeys } from "@/lib/storage";

interface ServerBatch {
  id: string;
  userEmail: string;
  deletedByUser?: boolean;
  deletedAt?: string;
  [k: string]: unknown;
}

// User flags one or more of their own batches as deleted (visible to admin only)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { batchIds, all } = await req.json();

  // "all" = mark every batch belonging to this user
  if (all) {
    const keys = await kvKeys("batch:*");
    let markedCount = 0;
    for (const key of keys) {
      const batch = await kvGet<ServerBatch>(key);
      if (batch && batch.userEmail === session.email && !batch.deletedByUser) {
        batch.deletedByUser = true;
        batch.deletedAt = new Date().toISOString();
        await kvSet(key, batch);
        markedCount++;
      }
    }
    return NextResponse.json({ success: true, markedCount });
  }

  // Individual batch IDs
  if (!Array.isArray(batchIds) || batchIds.length === 0) {
    return NextResponse.json({ error: "batchIds (array) or all=true required" }, { status: 400 });
  }

  let markedCount = 0;
  for (const id of batchIds) {
    const batch = await kvGet<ServerBatch>(`batch:${id}`);
    if (!batch) continue;
    // Only let users mark their own batches
    if (batch.userEmail !== session.email) continue;
    if (batch.deletedByUser) continue;
    batch.deletedByUser = true;
    batch.deletedAt = new Date().toISOString();
    await kvSet(`batch:${id}`, batch);
    markedCount++;
  }

  return NextResponse.json({ success: true, markedCount });
}
