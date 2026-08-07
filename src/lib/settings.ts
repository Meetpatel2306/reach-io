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

// Per-user AI provider keys — encrypted entries, multiple per provider so the
// clients can rotate to the next key when one runs out of daily quota.
export interface StoredAiKeys {
  gemini: string[]; // encrypted
  groq: string[]; // encrypted
  importedFromEnv?: boolean;
}

// When the daily Ahmedabad digest goes out. The hour is stored in IST because
// that is the timezone the user picks it in — converting to UTC on write would
// silently shift the chosen time whenever the offset logic changed.
export interface DailyDigest {
  enabled: boolean;
  hourIst: number; // 0-23, IST
  minuteIst: number; // 0 or 30 — the scheduler ticks every half hour
  lastSentDate: string; // "YYYY-MM-DD" in IST — the once-per-day guard
}

interface UserSettings {
  smtp?: StoredSmtp | null;
  google?: StoredGoogle | null;
  aiKeys?: StoredAiKeys | null;
  dailyDigest?: DailyDigest | null;
  updatedAt?: string;
}

const DEFAULT_DIGEST: DailyDigest = { enabled: true, hourIst: 9, minuteIst: 0, lastSentDate: "" };

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

// ---- AI keys (per-user, encrypted, synced across devices) ----

export type AiProvider = "gemini" | "groq";

function emptyAiKeys(): StoredAiKeys {
  return { gemini: [], groq: [] };
}

export async function addAiKey(email: string, provider: AiProvider, key: string): Promise<void> {
  const s = await load(email);
  const cur = s.aiKeys || emptyAiKeys();
  // Skip exact duplicates (compare decrypted).
  const existing = cur[provider].map((e) => decryptSecret(e)).filter(Boolean);
  if (existing.includes(key.trim())) return;
  cur[provider] = [...cur[provider], encryptSecret(key.trim())];
  s.aiKeys = cur;
  await save(email, s);
}

export async function removeAiKey(email: string, provider: AiProvider, index: number): Promise<void> {
  const s = await load(email);
  const cur = s.aiKeys || emptyAiKeys();
  cur[provider] = cur[provider].filter((_, i) => i !== index);
  s.aiKeys = cur;
  await save(email, s);
}

function maskKey(k: string): string {
  return k.length <= 10 ? "••••••" : `${k.slice(0, 6)}••••••${k.slice(-4)}`;
}

// Keys for the settings UI. Masked by default; reveal=true returns the real
// values (it is the owner's own key, behind their authenticated session).
export async function getAiKeysView(
  email: string,
  reveal = false,
): Promise<{ gemini: string[]; groq: string[] }> {
  const s = await load(email);
  const cur = s.aiKeys || emptyAiKeys();
  const view = (list: string[]) =>
    list.map((e) => decryptSecret(e)).filter(Boolean).map((k) => (reveal ? k : maskKey(k)));
  return { gemini: view(cur.gemini), groq: view(cur.groq) };
}

// Decrypted keys for actual AI calls. The user's stored keys are the ONLY
// source — there is no environment fallback: every user brings their own keys
// via the AI keys section on the Jobs page.
export async function getAiKeysForUse(email: string): Promise<{ gemini: string[]; groq: string[] }> {
  const s = await load(email);
  const cur = s.aiKeys || emptyAiKeys();
  return {
    gemini: cur.gemini.map((e) => decryptSecret(e)).filter(Boolean),
    groq: cur.groq.map((e) => decryptSecret(e)).filter(Boolean),
  };
}

// ---- Daily digest schedule ----

// IST is a fixed +5:30 offset with no daylight saving, so a plain shift is exact.
// `minutes` is minutes-since-midnight, which makes schedule comparison a single
// integer check instead of fiddly hour-then-minute logic.
export function istNow(at: Date = new Date()): { date: string; hour: number; minutes: number } {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    date: ist.toISOString().slice(0, 10),
    hour: ist.getUTCHours(),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

export function digestMinutes(d: DailyDigest): number {
  return d.hourIst * 60 + d.minuteIst;
}

export async function getDailyDigest(email: string): Promise<DailyDigest> {
  const s = await load(email);
  return { ...DEFAULT_DIGEST, ...(s.dailyDigest || {}) };
}

export async function saveDailyDigest(
  email: string,
  patch: { enabled?: boolean; hourIst?: number; minuteIst?: number },
): Promise<DailyDigest> {
  const s = await load(email);
  const cur = { ...DEFAULT_DIGEST, ...(s.dailyDigest || {}) };
  const before = digestMinutes(cur);

  if (typeof patch.enabled === "boolean") cur.enabled = patch.enabled;
  if (typeof patch.hourIst === "number" && Number.isInteger(patch.hourIst)) {
    cur.hourIst = Math.min(23, Math.max(0, patch.hourIst));
  }
  if (typeof patch.minuteIst === "number" && Number.isInteger(patch.minuteIst)) {
    cur.minuteIst = patch.minuteIst >= 30 ? 30 : 0;
  }

  // Moving the time is an instruction to use the NEW time starting now — so
  // clear the once-per-day guard. Without this, changing 6:30 AM to 5:00 PM
  // after the morning send would do nothing until tomorrow, which reads as the
  // setting being ignored. Re-enabling after a pause resets it for the same
  // reason.
  if (digestMinutes(cur) !== before || patch.enabled === true) cur.lastSentDate = "";

  s.dailyDigest = cur;
  await save(email, s);
  return cur;
}

// Stamped only after a digest actually goes out, so a failed send is retried on
// the next tick rather than being silently marked done for the day.
export async function markDigestSent(email: string, date: string): Promise<void> {
  const s = await load(email);
  s.dailyDigest = { ...DEFAULT_DIGEST, ...(s.dailyDigest || {}), lastSentDate: date };
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
