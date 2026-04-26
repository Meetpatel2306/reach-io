import { NextResponse } from "next/server";

// Initiates Google OAuth flow
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    // Redirect back to home with friendly error
    return NextResponse.redirect(`${url.origin}/?oauth_error=not_configured`);
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;

  const scope = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
