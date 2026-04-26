import { NextRequest, NextResponse } from "next/server";

// Public routes that don't require auth
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/me",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/google/refresh",
  "/api/config", // public config (no secrets)
  "/api/upload-resume", // optional: could require auth
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow Next.js internals + static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/version.json" ||
    pathname === "/favicon.ico" ||
    pathname === "/apple-touch-icon.svg" ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = req.cookies.get("eb_session");
  if (!sessionCookie) {
    // Redirect to login (preserve intended destination)
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
