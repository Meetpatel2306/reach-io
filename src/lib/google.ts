// Server-side Google OAuth token helpers.

// Mint a fresh access token from a stored refresh token. Returns null if Google
// OAuth isn't configured, the refresh token is revoked/expired, or the request
// fails — callers treat null as "reconnect Google needed".
export async function getGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const tokens = await res.json();
    return tokens.access_token || null;
  } catch {
    return null;
  }
}
