// Email-Blaster's AuthAdapter — wraps the REST API at /api/auth/*
// so the shared auth-kit pages (LoginPage, RegisterPage, ForgotPage, AdminPage)
// can drive it without knowing the backend.

import type { AuthAdapter, UserProfile } from "auth-kit";

async function asJson(res: Response): Promise<{ user?: UserProfile; users?: UserProfile[]; error?: string }> {
  try { return await res.json(); }
  catch { return { error: "Invalid response" }; }
}

async function ensureOk(res: Response): Promise<Record<string, unknown>> {
  const data = await asJson(res);
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as Record<string, unknown>;
}

export const authAdapter: AuthAdapter = {
  async register(input) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        displayName: input.displayName,
        password: input.password,
        avatar: input.avatar,
        securityQuestion: input.securityQuestion,
        securityAnswer: input.securityAnswer,
      }),
    });
    const data = await ensureOk(res);
    return data.user as UserProfile;
  },

  async login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await ensureOk(res);
    return data.user as UserProfile;
  },

  async logout() {
    await fetch("/api/auth/logout", { method: "POST" });
  },

  async resetPassword(email, securityAnswer, newPassword) {
    const res = await fetch("/api/auth/reset-password-security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, securityAnswer, newPassword }),
    });
    const data = await ensureOk(res);
    return data.user as UserProfile;
  },

  async byEmail(email) {
    try {
      const res = await fetch(`/api/auth/lookup?email=${encodeURIComponent(email)}`);
      const data = await asJson(res);
      return (data.user as UserProfile) || null;
    } catch { return null; }
  },

  async current() {
    const res = await fetch("/api/auth/me");
    const data = await asJson(res);
    return (data.user as UserProfile) || null;
  },

  async list() {
    const res = await fetch("/api/admin/users");
    const data = await asJson(res) as { users?: Array<{ email: string; name: string; role: "admin" | "user"; createdAt: string; lastLoginAt?: string; avatar?: string }> };
    if (!data.users) return [];
    // Map our internal User shape to UserProfile
    return data.users.map((u) => ({
      id: u.email,
      email: u.email,
      displayName: u.name,
      avatar: u.avatar || "👤",
      isAdmin: u.role === "admin",
      createdAt: new Date(u.createdAt).getTime(),
      lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0,
    }));
  },

  async remove(id) {
    // Our delete-user API expects email (id == email here)
    await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: id }),
    });
  },

  async promoteAdmin(_id) {
    // Email-blaster doesn't currently expose promote/demote endpoints.
    // No-op for now — kit's admin shows the buttons but they won't change role.
  },

  async demoteAdmin(_id) {
    // Same as above — placeholder.
  },
};
