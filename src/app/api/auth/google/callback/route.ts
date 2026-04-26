import { NextResponse } from "next/server";

// Handles OAuth callback: exchanges code for tokens, then redirects to app with tokens
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

    // Verify gmail.send scope was granted (Google may silently drop it if not registered in consent screen)
    const grantedScopes = (tokens.scope || "").split(" ");
    if (!grantedScopes.includes("https://www.googleapis.com/auth/gmail.send")) {
      return NextResponse.redirect(`${url.origin}/?oauth_error=gmail_scope_not_granted`);
    }

    // Get user email from userinfo
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // Pass tokens via URL fragment (#) so they're not sent to server logs
    // Client picks them up from hash and stores in localStorage
    const fragment = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || "",
      expires_in: String(tokens.expires_in || 3600),
      email: userInfo.email || "",
      name: userInfo.name || "",
    });

    return NextResponse.redirect(`${url.origin}/#oauth=${encodeURIComponent(fragment.toString())}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(`${url.origin}/?oauth_error=${encodeURIComponent(msg)}`);
  }
}
