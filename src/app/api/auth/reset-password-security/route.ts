import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, hashPassword, saveUser, verifyPassword } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const PASSWORD_MIN_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 reset attempts per IP per hour
    const ip = getClientIp(req);
    const rl = await rateLimit({ key: `reset:${ip}`, max: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many reset attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const { email, securityAnswer, newPassword } = await req.json();
    if (!email || !securityAnswer || !newPassword) {
      return NextResponse.json({ error: "Email, answer, and new password required" }, { status: 400 });
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!user.securityAnswerHash) {
      return NextResponse.json({ error: "This account doesn't have a security question. Contact admin to reset." }, { status: 400 });
    }

    const answerOk = await verifyPassword(securityAnswer.toLowerCase().trim(), user.securityAnswerHash);
    if (!answerOk) return NextResponse.json({ error: "Wrong answer to security question" }, { status: 401 });

    user.passwordHash = await hashPassword(newPassword);
    await saveUser(user);

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
    const msg = err instanceof Error ? err.message : "Reset failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
