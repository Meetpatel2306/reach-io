import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, hashPassword, saveUser } from "@/lib/auth";
import { kvDel, kvGet } from "@/lib/storage";

interface ResetRecord { email: string; expiresAt: number; }

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 chars" }, { status: 400 });

    const record = await kvGet<ResetRecord>(`reset:${token}`);
    if (!record) return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    if (Date.now() > record.expiresAt) {
      await kvDel(`reset:${token}`);
      // Opportunistic cleanup: scan and delete other expired tokens too
      try {
        const { kvKeys } = await import("@/lib/storage");
        const keys = await kvKeys("reset:*");
        for (const k of keys) {
          const r = await kvGet<ResetRecord>(k);
          if (r && Date.now() > r.expiresAt) await kvDel(k);
        }
      } catch {}
      return NextResponse.json({ error: "Token has expired" }, { status: 400 });
    }

    const user = await getUserByEmail(record.email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    user.passwordHash = await hashPassword(password);
    await saveUser(user);
    await kvDel(`reset:${token}`);

    return NextResponse.json({ success: true, message: "Password reset successful. Please log in." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reset failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
