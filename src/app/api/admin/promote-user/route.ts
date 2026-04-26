import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserByEmail, saveUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const user = await getUserByEmail(email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  user.role = "admin";
  await saveUser(user);
  return NextResponse.json({ success: true, message: `${email} is now an admin` });
}
