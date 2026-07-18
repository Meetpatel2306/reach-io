// Server-only symmetric encryption for secrets stored at rest in KV
// (SMTP app-passwords, Google refresh tokens). AES-256-GCM.
//
// The key is derived from SESSION_SECRET (already required in production for
// iron-session) so no additional env var is needed. If SESSION_SECRET ever
// rotates, old ciphertext simply fails to decrypt and returns null — callers
// treat that as "not configured / reconnect needed" rather than crashing.

import crypto from "crypto";

const APP_SALT = "reachio.settings.v1"; // fixed, non-secret domain separator
// Mirror auth.ts's dev fallback so encrypt/decrypt work locally without a secret.
const DEV_FALLBACK = "dev-only-secret-min-32-chars-long-please-change!";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SESSION_SECRET || DEV_FALLBACK;
  cachedKey = crypto.scryptSync(secret, APP_SALT, 32);
  return cachedKey;
}

// Returns "v1:<iv b64>:<tag b64>:<ciphertext b64>". Empty input → "".
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// Reverses encryptSecret. Returns "" on any malformed/undecryptable input
// (e.g. after a SESSION_SECRET rotation) so callers can prompt a reconnect.
export function decryptSecret(payload: string | undefined | null): string {
  if (!payload) return "";
  try {
    const [ver, ivB64, tagB64, ctB64] = payload.split(":");
    if (ver !== "v1" || !ivB64 || !tagB64 || !ctB64) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    return "";
  }
}
