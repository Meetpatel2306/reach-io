import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kvGet, kvSet } from "@/lib/storage";
import type { SupportTicket } from "../tickets/route";

// POST — add a reply to a ticket. Anyone (user OR admin) can reply to a ticket they're part of.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ticketId, message, status } = await req.json();
  if (!ticketId || !message?.trim()) {
    return NextResponse.json({ error: "ticketId and message required" }, { status: 400 });
  }

  const ticket = await kvGet<SupportTicket>(`ticket:${ticketId}`);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  // Only the ticket owner or admin can reply
  const isAdmin = session.role === "admin";
  const isOwner = ticket.userEmail === session.email;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  ticket.replies.push({
    from: isAdmin ? "admin" : "user",
    fromName: session.name || (isAdmin ? "Admin" : session.email || ""),
    message: message.trim(),
    timestamp: new Date().toISOString(),
    read: false,
  });
  ticket.updatedAt = new Date().toISOString();

  // Admin can also change status (e.g. mark resolved)
  if (isAdmin && (status === "open" || status === "resolved")) {
    ticket.status = status;
  }

  await kvSet(`ticket:${ticketId}`, ticket);
  return NextResponse.json({ success: true, ticket });
}
