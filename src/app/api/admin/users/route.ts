import { NextResponse } from "next/server";
import { getSession, listUsers } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listUsers();
  // Strip password hashes
  return NextResponse.json({
    users: users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      sessionMaxAgeMs: u.sessionMaxAgeMs,
    })),
  });
}
