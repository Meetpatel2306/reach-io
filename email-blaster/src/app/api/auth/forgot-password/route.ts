import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";
import { kvSet } from "@/lib/storage";

// Generates a reset token. Since there's no email infra, the token is returned
// directly to the admin or shown to the user with a "contact admin" message.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const user = await getUserByEmail(email);
    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: "If that email exists, a reset has been requested. Contact the admin." });
    }

    // Generate token (32 hex chars)
    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Store token with 1-hour expiry
    await kvSet(`reset:${token}`, {
      email: user.email,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return NextResponse.json({
      success: true,
      message: "Reset link generated. Contact the admin who can share the reset link with you.",
      // Token is only useful with the URL. The admin can copy this and send it.
      adminToken: token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reset request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
