// Lookup endpoint for password recovery flow.
// SECURITY: Rate-limited per IP. Returns the security QUESTION (which is one of a fixed set
// of public phrases anyway) but ONLY after passing rate limit. The answer is what protects
// the account, not the question itself.

import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Rate limit: 5 lookups per IP per hour to prevent enumeration
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: `lookup:${ip}`, max: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many lookup attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

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
