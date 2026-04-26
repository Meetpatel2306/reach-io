// Public endpoint (auth-required) — returns when admin last cleared all data.
// Used by the user's history page to show a notice.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kvGet } from "@/lib/storage";

interface ClearEvent {
  timestamp: string;
  by: string;
  byName: string;
  deletedKeys: number;
}

export async function GET() {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ event: null });
  }

  const event = await kvGet<ClearEvent>("data-cleared-at");
  return NextResponse.json({ event });
}
