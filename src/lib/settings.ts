// Server-only per-user settings store (syncs across devices via KV).
// Holds the email-sending credentials that used to live in browser localStorage:
//   - SMTP config (app password encrypted at rest)
//   - Google connection (refresh token encrypted at rest)
// Secrets are NEVER returned to the client — only a redacted "view". The send
// route uses the *ForSend getters, which decrypt server-side.

import { kvGet, kvSet, kvDel } from "./storage";
import { encryptSecret, decryptSecret } from "./crypto";
import { nowIso } from "./jobAppShared";

const kSettings = (email: string) => `job:${email.toLowerCase()}:settings`;

export interface StoredSmtp {
  host: string;
  port: string;
  user: string;
  passEnc: string;
  security: string;
}

export interface StoredGoogle {
  email: string;
  name: string;
  refreshTokenEnc: string;
  connectedAt: string;
}

interface UserSettings {
  smtp?: StoredSmtp | null;
  google?: StoredGoogle | null;
  updatedAt?: string;
}

// ---- Redacted view for the client (no secrets) ----
export interface SettingsView {
  smtp: { host: string; port: string; user: string; security: string; configured: true } | null;
  google: { email: string; name: string; connected: true } | null;
}

async function load(email: string): Promise<UserSettings> {
  return (await kvGet<UserSettings>(kSettings(email))) || {};
}

async function save(email: string, s: UserSettings): Promise<void> {
  await kvSet(kSettings(email), { ...s, updatedAt: nowIso() });
}

export async function getSettingsView(email: string): Promise<SettingsView> {
  const s = await load(email);
  return {
    smtp: s.smtp
      ? { host: s.smtp.host, port: s.smtp.port, user: s.smtp.user, security: s.smtp.security, configured: true }
      : null,
    google: s.google ? { email: s.google.email, name: s.google.name, connected: true } : null,
  };
}

// ---- SMTP ----

export async function saveSmtp(
  email: string,
  cfg: { host: string; port: string; user: string; pass: string; security: string },
): Promise<void> {
  const s = await load(email);
  s.smtp = {
    host: (cfg.host || "smtp.gmail.com").trim(),
    port: (cfg.port || "587").trim(),
    user: cfg.user.trim(),
    passEnc: encryptSecret(cfg.pass),
    security: (cfg.security || "starttls").trim(),
  };
  await save(email, s);
}

export async function clearSmtp(email: string): Promise<void> {
  const s = await load(email);
  s.smtp = null;
  await save(email, s);
}

// Server-only: decrypted SMTP creds for actually sending. null if not configured.
export async function getSmtpForSend(
  email: string,
): Promise<{ host: string; port: string; user: string; pass: string; security: string } | null> {
  const s = await load(email);
  if (!s.smtp || !s.smtp.user) return null;
  const pass = decryptSecret(s.smtp.passEnc);
  if (!pass) return null; // undecryptable (secret rotated) → treat as not configured
  return { host: s.smtp.host, port: s.smtp.port, user: s.smtp.user, pass, security: s.smtp.security };
}

// ---- Google ----

export async function saveGoogle(
  email: string,
  g: { email: string; name: string; refreshToken: string },
): Promise<void> {
  const s = await load(email);
  const existing = s.google;
  // Google only returns a refresh_token on the first consent; keep the old one
  // if a re-auth (incremental) came back without one.
  const refreshTokenEnc = g.refreshToken
    ? encryptSecret(g.refreshToken)
    : existing?.refreshTokenEnc || "";
  s.google = {
    email: g.email,
    name: g.name,
    refreshTokenEnc,
    connectedAt: nowIso(),
  };
  await save(email, s);
}

export async function clearGoogle(email: string): Promise<void> {
  const s = await load(email);
  s.google = null;
  await save(email, s);
}

// Server-only: the Google account email + decrypted refresh token, for the send
// route to mint a fresh access token. null if not connected / no usable token.
export async function getGoogleForSend(
  email: string,
): Promise<{ email: string; refreshToken: string } | null> {
  const s = await load(email);
  if (!s.google || !s.google.email) return null;
  const refreshToken = decryptSecret(s.google.refreshTokenEnc);
  if (!refreshToken) return null;
  return { email: s.google.email, refreshToken };
}
