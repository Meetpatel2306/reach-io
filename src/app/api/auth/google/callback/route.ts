import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveGoogle } from "@/lib/settings";

// Handles the OAuth callback: exchanges the code for tokens and stores the
// refresh token on the logged-in user's account (encrypted, server-side) so the
// Google connection syncs across devices and survives browser-storage eviction.
// The client never sees the tokens — the send route mints access tokens itself.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${url.origin}/?oauth_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${url.origin}/?oauth_error=missing_code`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${url.origin}/?oauth_error=not_configured`);
  }

  // Must be logged into the app so we know which account to attach Google to.
  const session = await getSession();
  if (!session.email) {
    return NextResponse.redirect(`${url.origin}/login?from=${encodeURIComponent("/")}`);
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return NextResponse.redirect(`${url.origin}/?oauth_error=${encodeURIComponent(errText.slice(0, 100))}`);
    }

    const tokens = await tokenRes.json();
    // tokens = { access_token, refresh_token, expires_in, token_type, scope, id_token }

    // Verify gmail.send scope was granted (Google may silently drop it if not
    // registered in the consent screen).
    const grantedScopes = (tokens.scope || "").split(" ");
    if (!grantedScopes.includes("https://www.googleapis.com/auth/gmail.send")) {
      return NextResponse.redirect(`${url.origin}/?oauth_error=gmail_scope_not_granted`);
    }

    // Get the Google account email/name from userinfo.
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    await saveGoogle(session.email, {
      email: userInfo.email || "",
      name: userInfo.name || "",
      refreshToken: tokens.refresh_token || "",
    });

    return NextResponse.redirect(`${url.origin}/?google=connected`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(`${url.origin}/?oauth_error=${encodeURIComponent(msg)}`);
  }
}
