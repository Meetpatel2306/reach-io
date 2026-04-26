// Admin-only: wipes all batches + tickets but PRESERVES user accounts.
// Records the timestamp so users see a notice in their history page.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kvDel, kvKeys, kvSet } from "@/lib/storage";

export async function POST() {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let deleted = 0;

  // Patterns to wipe — everything EXCEPT users + rate-limits
  const patterns = ["batch:*", "userbatch:*", "ticket:*", "reset:*"];
  for (const pattern of patterns) {
    const keys = await kvKeys(pattern);
    for (const key of keys) {
      await kvDel(key);
      deleted++;
    }
  }

  // Record the clear event so users see a banner in their history page
  await kvSet("data-cleared-at", {
    timestamp: new Date().toISOString(),
    by: session.email || "admin",
    byName: session.name || "",
    deletedKeys: deleted,
  });

  return NextResponse.json({
    success: true,
    deletedKeys: deleted,
    message: `Cleared ${deleted} records. User accounts preserved.`,
  });
}
