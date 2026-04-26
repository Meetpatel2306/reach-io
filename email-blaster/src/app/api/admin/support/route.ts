import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kvGet, kvKeys } from "@/lib/storage";
import type { SupportTicket } from "../../support/tickets/route";

// GET — admin only — list ALL support tickets
export async function GET() {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await kvKeys("ticket:*");
  const tickets = await Promise.all(keys.map((k) => kvGet<SupportTicket>(k)));
  const valid = tickets.filter((t): t is SupportTicket => !!t);
  // Sort: open first, then by updatedAt desc
  valid.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return NextResponse.json({ tickets: valid });
}
