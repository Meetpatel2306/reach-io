import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, name, displayName, password, avatar, securityQuestion, securityAnswer } = await req.json();
    const userName = displayName || name; // accept both "name" and "displayName" (auth-kit)
    if (!email || !password || !userName) {
      return NextResponse.json({ error: "Email, name, and password are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    const user = await createUser(email, userName, password, { avatar, securityQuestion, securityAnswer });

    // auth-kit's adapter expects the full UserProfile back, including the kit's id field.
    // We map our internal User → UserProfile shape inline.
    return NextResponse.json({
      success: true,
      message: "Account created successfully. Please sign in.",
      user: toProfile(user),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// Local helper — duplicates lib/profile.ts mapping to avoid extra imports here.
function toProfile(u: { email: string; name: string; role: "admin" | "user"; createdAt: string; lastLoginAt?: string; avatar?: string }) {
  return {
    id: u.email,
    email: u.email,
    displayName: u.name,
    avatar: u.avatar || "👤",
    isAdmin: u.role === "admin",
    createdAt: new Date(u.createdAt).getTime(),
    lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0,
  };
}
