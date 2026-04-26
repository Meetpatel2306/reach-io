import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kvGet, kvSet, kvKeys } from "@/lib/storage";

export interface TicketReply {
  from: "user" | "admin";
  fromName: string;
  message: string;
  timestamp: string;
  read?: boolean;
}

export interface SupportTicket {
  id: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: "open" | "resolved";
  priority: "low" | "normal" | "high";
  category: "bug" | "question" | "feature" | "other";
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}

// GET — list tickets for the current user
export async function GET() {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keys = await kvKeys("ticket:*");
  const tickets = await Promise.all(keys.map((k) => kvGet<SupportTicket>(k)));
  const userTickets = tickets
    .filter((t): t is SupportTicket => !!t && t.userEmail === session.email)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({ tickets: userTickets });
}

// POST — create a new ticket
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { subject, message, category, priority } = await req.json();
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message required" }, { status: 400 });
  }

  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: ticketId,
    userEmail: session.email,
    userName: session.name || "",
    subject: subject.trim(),
    message: message.trim(),
    status: "open",
    priority: priority || "normal",
    category: category || "other",
    createdAt: now,
    updatedAt: now,
    replies: [],
  };

  await kvSet(`ticket:${ticketId}`, ticket);
  return NextResponse.json({ success: true, ticket });
}
