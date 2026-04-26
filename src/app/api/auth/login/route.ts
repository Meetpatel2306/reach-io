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
