// Client-side Google OAuth token management
// Tokens stored in localStorage; access tokens auto-refresh via /api/auth/google/refresh

const KEY = "email-blaster-google-oauth";

export interface OAuthSession {
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

export function loadOAuth(): OAuthSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveOAuth(session: OAuthSession) {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch {}
}

export function clearOAuth() {
  try { localStorage.removeItem(KEY); } catch {}
}

// Parse OAuth callback fragment (#oauth=...) and save session
// Returns the session if successful, or null if no fragment present
export function consumeOAuthFragment(): OAuthSession | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith("#oauth=")) return null;

  try {
    const payload = decodeURIComponent(hash.slice("#oauth=".length));
    const params = new URLSearchParams(payload);
    const accessToken = params.get("access_token") || "";
    const refreshToken = params.get("refresh_token") || "";
    const expiresIn = parseInt(params.get("expires_in") || "3600");
    const email = params.get("email") || "";
    const name = params.get("name") || "";

    if (!accessToken || !email) return null;

    const session: OAuthSession = {
      email,
      name,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000 - 60_000, // refresh 60s early
    };
    saveOAuth(session);

    // Remove the fragment from URL so it's not re-processed
    history.replaceState(null, "", window.location.pathname + window.location.search);

    return session;
  } catch {
    return null;
  }
}

// Get a fresh access token (refreshes if expired)
export async function getValidAccessToken(): Promise<string | null> {
  const session = loadOAuth();
  if (!session) return null;

  if (Date.now() < session.expiresAt) {
    return session.accessToken;
  }

  // Refresh via server
  if (!session.refreshToken) return null;
  try {
    const res = await fetch("/api/auth/google/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;

    const updated: OAuthSession = {
      ...session,
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60_000,
    };
    saveOAuth(updated);
    return updated.accessToken;
  } catch {
    return null;
  }
}

export function startOAuth() {
  window.location.href = "/api/auth/google";
}
