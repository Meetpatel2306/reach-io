import { NextRequest, NextResponse } from "next/server";
import { ADMIN_EMAIL, deleteUser, getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const target = email.toLowerCase();

  // Cannot delete the primary admin account
  if (target === ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Cannot delete the primary admin account" }, { status: 400 });
  }

  // Cannot delete yourself
  if (session.email && target === session.email.toLowerCase()) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  await deleteUser(email);
  return NextResponse.json({ success: true });
}
