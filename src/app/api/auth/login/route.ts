import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, saveUser, setSessionUser, verifyPassword } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 attempts per IP per 15 minutes
    const ip = getClientIp(req);
    const rl = await rateLimit({ key: `login:${ip}`, max: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "User not found. Please register first.", code: "USER_NOT_FOUND" }, { status: 404 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Wrong password. Try again.", code: "WRONG_PASSWORD" }, { status: 401 });
    }

    user.lastLoginAt = new Date().toISOString();
    await saveUser(user);
    await setSessionUser(user);

    return NextResponse.json({
      success: true,
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
    const msg = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
