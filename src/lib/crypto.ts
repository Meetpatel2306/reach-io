// Server-only symmetric encryption for secrets stored at rest in KV
// (AI provider keys, SMTP app-passwords, Google refresh tokens). AES-256-GCM.
//
// These secrets belong to the user's ACCOUNT: added once, they must keep working
// on every device and every deploy, forever. That makes decryption durability a
// correctness requirement, not a nicety — an unreadable key is indistinguishable
// from a missing one, because the callers .filter(Boolean) it away and the user
// is simply told to add their key again.
//
// So decryption is tried against every secret this deployment knows about, newest
// first, while encryption always uses the primary:
//
//   1. ENCRYPTION_SECRET — dedicated, so rotating the session secret (a routine
//      security action) no longer silently destroys every stored credential
//   2. SESSION_SECRET    — what everything was encrypted with before this change
//   3. DEV_FALLBACK      — local runs that never had a secret configured
//
// Ciphertext written under any of them still opens, which is what makes a key
// added on the deployed site keep working under `npm run dev` and vice versa.

import crypto from "crypto";

const APP_SALT = "reachio.settings.v1"; // fixed, non-secret domain separator
// Mirror auth.ts's dev fallback so encrypt/decrypt work locally without a secret.
const DEV_FALLBACK = "dev-only-secret-min-32-chars-long-please-change!";

let cachedKeys: Buffer[] | null = null;

// Every secret worth trying, in priority order, de-duplicated. The first entry
// is the one new ciphertext is written with.
function getKeys(): Buffer[] {
  if (cachedKeys) return cachedKeys;
  const secrets: string[] = [];
  for (const s of [process.env.ENCRYPTION_SECRET, process.env.SESSION_SECRET, DEV_FALLBACK]) {
    if (s && !secrets.includes(s)) secrets.push(s);
  }
  cachedKeys = secrets.map((s) => crypto.scryptSync(s, APP_SALT, 32));
  return cachedKeys;
}

function getKey(): Buffer {
  return getKeys()[0];
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

// Reverses encryptSecret, trying every known secret so a credential saved under
// an older one keeps working. Returns "" only when NONE of them can open it.
export function decryptSecret(payload: string | undefined | null): string {
  if (!payload) return "";
  const [ver, ivB64, tagB64, ctB64] = payload.split(":");
  if (ver !== "v1" || !ivB64 || !tagB64 || !ctB64) return "";
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  for (const key of getKeys()) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      // GCM verifies the tag in final(): a wrong key throws here rather than
      // returning garbage, so this loop cannot silently return a bad value.
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      return pt.toString("utf8");
    } catch {
      // Wrong key — try the next one.
    }
  }
  return "";
}
