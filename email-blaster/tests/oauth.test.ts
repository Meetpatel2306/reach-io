import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { loadOAuth, saveOAuth, clearOAuth, getValidAccessToken, type OAuthSession } from "@/lib/oauth";

const makeSession = (overrides: Partial<OAuthSession> = {}): OAuthSession => ({
  email: "user@gmail.com",
  name: "Test User",
  accessToken: "ya29.fake-access-token",
  refreshToken: "1//fake-refresh-token",
  expiresAt: Date.now() + 3600 * 1000,
  ...overrides,
});

describe("OAuth localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadOAuth returns null when no session", () => {
    expect(loadOAuth()).toBeNull();
  });

  it("saveOAuth + loadOAuth round-trips correctly", () => {
    const session = makeSession();
    saveOAuth(session);
    expect(loadOAuth()).toEqual(session);
  });

  it("clearOAuth removes saved session", () => {
    saveOAuth(makeSession());
    expect(loadOAuth()).not.toBeNull();
    clearOAuth();
    expect(loadOAuth()).toBeNull();
  });

  it("loadOAuth handles corrupt localStorage gracefully", () => {
    localStorage.setItem("email-blaster-google-oauth", "not-json");
    expect(loadOAuth()).toBeNull();
  });
});

describe("getValidAccessToken", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null when no session is stored", async () => {
    const token = await getValidAccessToken();
    expect(token).toBeNull();
  });

  it("returns the stored token when not expired", async () => {
    saveOAuth(makeSession({ accessToken: "fresh-token", expiresAt: Date.now() + 3600 * 1000 }));
    const token = await getValidAccessToken();
    expect(token).toBe("fresh-token");
  });

  it("refreshes the token when expired", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-fresh-token", expires_in: 3600 }),
    } as Response);

    saveOAuth(makeSession({ accessToken: "expired-token", expiresAt: Date.now() - 1000 }));
    const token = await getValidAccessToken();
    expect(token).toBe("new-fresh-token");

    // Verify the refreshed token was saved
    expect(loadOAuth()?.accessToken).toBe("new-fresh-token");
  });

  it("returns null when refresh fails (no refresh_token)", async () => {
    saveOAuth(makeSession({ refreshToken: "", expiresAt: Date.now() - 1000 }));
    const token = await getValidAccessToken();
    expect(token).toBeNull();
  });

  it("returns null when refresh request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    saveOAuth(makeSession({ expiresAt: Date.now() - 1000 }));
    const token = await getValidAccessToken();
    expect(token).toBeNull();
  });
});
