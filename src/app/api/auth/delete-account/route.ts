// User deletes their OWN account (self-service).
// This is different from /api/admin/delete-user which only admins can call.

import { NextRequest, NextResponse } from "next/server";
import { ADMIN_EMAIL, deleteUser, destroySession, getSession, getUserByEmail, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Primary admin cannot self-delete via this route — protects the seed admin
  if (session.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Primary admin account cannot self-delete. Modify ADMIN_EMAIL in code first or delete via Upstash dashboard." }, { status: 400 });
  }

  // Verify password before deletion (prevents stolen-cookie account loss)
  const { password } = await req.json();
  if (!password) {
    return NextResponse.json({ error: "Password required to confirm deletion" }, { status: 400 });
  }

  const user = await getUserByEmail(session.email);
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 401 });

  await deleteUser(session.email);
  await destroySession();

  return NextResponse.json({ success: true, message: "Your account has been permanently deleted." });
}
