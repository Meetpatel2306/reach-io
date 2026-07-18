import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, getSession } from "@/lib/auth";
import { kvSet } from "@/lib/storage";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Generates a password-reset token. The token is only ever revealed to a
// logged-in ADMIN generating a reset link for a user — never to an anonymous
// caller (handing it back in the response was an account-takeover hole).
export async function POST(req: NextRequest) {
  try {
    // Rate limit to stop token harvesting / email enumeration.
    const ip = getClientIp(req);
    const rl = await rateLimit({ key: `forgot:${ip}`, max: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const user = await getUserByEmail(email);
    // Always return success to prevent email enumeration.
    if (!user) {
      return NextResponse.json({ success: true, message: "If that email exists, a reset has been requested. Contact the admin." });
    }

    // Generate token (32 hex chars) with 1-hour expiry.
    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    await kvSet(`reset:${token}`, { email: user.email, expiresAt: Date.now() + 60 * 60 * 1000 });

    // Only a logged-in admin gets the token back (to build the reset link).
    const session = await getSession();
    const isAdmin = session.role === "admin";

    return NextResponse.json({
      success: true,
      message: isAdmin
        ? "Reset link token generated below."
        : "Reset requested. Contact the admin who can share the reset link with you.",
      ...(isAdmin ? { adminToken: token } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reset request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
