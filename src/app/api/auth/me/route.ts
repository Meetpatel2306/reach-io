import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, getSession, getUserByEmail } from "@/lib/auth";

// A "ghost session" is an eb_session cookie that still exists but no longer
// resolves to a user — the secret was rotated, the cookie predates a deploy, or
// the user record was removed. The middleware only checks that the cookie is
// PRESENT, so a ghost cookie still gets past it: the page renders, but every
// authenticated call fails. The result is a signed-out app that looks signed in
// (no nav, "Configure Email First" on a fully filled form).
//
// Clearing the dead cookie here is what breaks that loop — once it is gone the
// middleware redirects to /login on the next request, as it should have all along.
async function staleSession() {
  await destroySession();
  return NextResponse.json({ user: null, stale: true });
}

export async function GET() {
  const session = await getSession();
  if (!session.email) {
    // No email in the session, but a cookie was still sent: that cookie is dead.
    const hasCookie = (await cookies()).has("eb_session");
    return hasCookie ? await staleSession() : NextResponse.json({ user: null });
  }
  const user = await getUserByEmail(session.email);
  if (!user) return await staleSession();

  // Return both the legacy shape AND the auth-kit UserProfile shape
  return NextResponse.json({
    user: {
      // legacy fields
      email: user.email,
      name: user.name,
      role: user.role,
      // auth-kit UserProfile fields
      id: user.email,
      displayName: user.name,
      avatar: user.avatar || "👤",
      isAdmin: user.role === "admin",
      createdAt: new Date(user.createdAt).getTime(),
      lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0,
    },
    expiresAt: session.expiresAt,
  });
}
