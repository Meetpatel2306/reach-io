import { NextRequest, NextResponse } from "next/server";
import { ADMIN_EMAIL, getSession, getUserByEmail, saveUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const target = email.toLowerCase();

  // Cannot demote the primary admin
  if (target === ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Cannot demote the primary admin account" }, { status: 400 });
  }

  // Cannot demote yourself
  if (session.email && target === session.email.toLowerCase()) {
    return NextResponse.json({ error: "You cannot demote your own account" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  user.role = "user";
  await saveUser(user);
  return NextResponse.json({ success: true, message: `${email} is no longer an admin` });
}
