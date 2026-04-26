import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserByEmail, hashPassword, saveUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, newPassword } = await req.json();
  if (!email || !newPassword) {
    return NextResponse.json({ error: "Email and newPassword required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 chars" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  user.passwordHash = await hashPassword(newPassword);
  await saveUser(user);
  return NextResponse.json({ success: true, message: `Password reset for ${email}` });
}
