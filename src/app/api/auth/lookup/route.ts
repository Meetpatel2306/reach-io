// Public, auth-not-required endpoint to look up a user's security question by email.
// Returns ONLY the security question (no password info).
// Used by auth-kit's ForgotPage during password recovery.

import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ user: null });

  const user = await getUserByEmail(email);
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.email,
      email: user.email,
      displayName: user.name,
      avatar: user.avatar || "👤",
      isAdmin: user.role === "admin",
      createdAt: new Date(user.createdAt).getTime(),
      lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0,
      securityQuestion: user.securityQuestion,
    },
  });
}
