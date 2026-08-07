import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Secrets stored at rest (AI provider keys, SMTP passwords, Google refresh
// tokens) belong to the user's ACCOUNT: added once, they must keep working on
// every device and every deploy. An unreadable secret is indistinguishable from
// a missing one — callers .filter(Boolean) it away and the user is told to add
// their key again — so decryption durability is a correctness guarantee.
//
// crypto.ts derives its AES key from an env secret and caches it at module
// scope, so each case re-imports the module with a fresh environment.

const ORIGINAL_ENV = { ...process.env };

async function freshCrypto(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env } as NodeJS.ProcessEnv;
  return await import("../src/lib/crypto");
}

const SESSION = "session-secret-that-is-long-enough-to-be-valid";
const DEDICATED = "a-completely-different-dedicated-encryption-secret";
const SECRET_VALUE = "AIzaSyExampleGeminiApiKeyValue1234567890";

describe("secret encryption durability", () => {
  beforeEach(() => {
    delete process.env.ENCRYPTION_SECRET;
    delete process.env.SESSION_SECRET;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("round-trips a secret", async () => {
    const { encryptSecret, decryptSecret } = await freshCrypto({ SESSION_SECRET: SESSION });
    expect(decryptSecret(encryptSecret(SECRET_VALUE))).toBe(SECRET_VALUE);
  });

  it("keeps reading keys after SESSION_SECRET is rotated away", async () => {
    // Saved when SESSION_SECRET was the only secret...
    const before = await freshCrypto({ SESSION_SECRET: SESSION });
    const stored = before.encryptSecret(SECRET_VALUE);

    // ...and a dedicated ENCRYPTION_SECRET is introduced afterwards. The old
    // ciphertext must still open, or every saved credential silently vanishes.
    const after = await freshCrypto({ SESSION_SECRET: SESSION, ENCRYPTION_SECRET: DEDICATED });
    expect(after.decryptSecret(stored)).toBe(SECRET_VALUE);
  });

  it("reads a key saved on a machine that had no secret configured", async () => {
    // Local `npm run dev` with no secret falls back to the dev default; the
    // deployed app has a real one. A key added in either place must work in both.
    const local = await freshCrypto({});
    const stored = local.encryptSecret(SECRET_VALUE);

    const deployed = await freshCrypto({ SESSION_SECRET: SESSION });
    expect(deployed.decryptSecret(stored)).toBe(SECRET_VALUE);
  });

  it("writes new ciphertext with ENCRYPTION_SECRET when it is present", async () => {
    const withDedicated = await freshCrypto({ SESSION_SECRET: SESSION, ENCRYPTION_SECRET: DEDICATED });
    const stored = withDedicated.encryptSecret(SECRET_VALUE);

    // Readable by a deployment that has only the dedicated secret — proving the
    // session secret is no longer load-bearing for data at rest.
    const dedicatedOnly = await freshCrypto({ ENCRYPTION_SECRET: DEDICATED });
    expect(dedicatedOnly.decryptSecret(stored)).toBe(SECRET_VALUE);
  });

  it("returns empty for ciphertext no known secret can open", async () => {
    const stranger = await freshCrypto({ ENCRYPTION_SECRET: "an-unrelated-secret-nobody-else-has-x" });
    const stored = stranger.encryptSecret(SECRET_VALUE);

    const ours = await freshCrypto({ SESSION_SECRET: SESSION });
    expect(ours.decryptSecret(stored)).toBe("");
  });

  it("returns empty for malformed or absent input", async () => {
    const { decryptSecret } = await freshCrypto({ SESSION_SECRET: SESSION });
    expect(decryptSecret("")).toBe("");
    expect(decryptSecret(undefined)).toBe("");
    expect(decryptSecret("not-encrypted-at-all")).toBe("");
    expect(decryptSecret("v2:a:b:c")).toBe("");
  });
});
