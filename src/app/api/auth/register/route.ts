import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const PASSWORD_MIN_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per hour
    const ip = getClientIp(req);
    const rl = await rateLimit({ key: `register:${ip}`, max: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many registration attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const { email, name, displayName, password, avatar, securityQuestion, securityAnswer } = await req.json();
    const userName = displayName || name;
    if (!email || !password || !userName) {
      return NextResponse.json({ error: "Email, name, and password are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` }, { status: 400 });
    }

    const user = await createUser(email, userName, password, { avatar, securityQuestion, securityAnswer });

    return NextResponse.json({
      success: true,
      message: "Account created successfully. Please sign in.",
      user: {
        id: user.email,
        email: user.email,
        displayName: user.name,
        avatar: user.avatar || "👤",
        isAdmin: user.role === "admin",
        createdAt: new Date(user.createdAt).getTime(),
        lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
