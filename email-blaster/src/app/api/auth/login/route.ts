import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, saveUser, setSessionUser, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    user.lastLoginAt = new Date().toISOString();
    await saveUser(user);
    await setSessionUser(user);

    return NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
