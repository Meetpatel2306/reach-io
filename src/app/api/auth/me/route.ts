import { NextResponse } from "next/server";
import { getSession, getUserByEmail } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ user: null });
  }
  const user = await getUserByEmail(session.email);
  if (!user) return NextResponse.json({ user: null });

  // Return both the legacy shape AND the auth-kit UserProfile shape
  return NextResponse.json({
    user: {
      // legacy fields
      email: user.email,
      name: user.name,
      role: user.role,
      // auth-kit UserProfile fields
      id: user.email,
      displayName: user.name,
      avatar: user.avatar || "👤",
      isAdmin: user.role === "admin",
      createdAt: new Date(user.createdAt).getTime(),
      lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0,
    },
    expiresAt: session.expiresAt,
  });
}
