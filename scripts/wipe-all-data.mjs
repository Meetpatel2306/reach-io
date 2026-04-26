#!/usr/bin/env node
// ============================================================
// DESTRUCTIVE: Wipes ALL Reach.io data from Vercel KV / Upstash.
//
// What it deletes (everything under the eb: namespace):
//   - All user accounts (eb:user:*)
//   - All send batches (eb:batch:*)
//   - User-batch index (eb:userbatch:*)
//   - Support tickets (eb:ticket:*)
//   - Reset password tokens (eb:reset:*)
//   - Rate-limit counters (eb:rl:*)
//   - Anything else under the eb: namespace
//
// What it does NOT touch:
//   - Your code/files on disk
//   - Vercel env vars
//   - Google OAuth credentials
//   - Browser localStorage (that's per-user, see end-of-output instructions)
//
// Usage:
//   1. Make sure your .env.local has:
//        KV_REST_API_URL=https://...
//        KV_REST_API_TOKEN=AbCd...
//      OR (if you used Upstash directly):
//        UPSTASH_REDIS_REST_URL=https://...
//        UPSTASH_REDIS_REST_TOKEN=AbCd...
//
//   2. Run from email-blaster/:
//        node scripts/wipe-all-data.mjs
//
//   3. Type "WIPE EVERYTHING" when prompted to confirm
// ============================================================

import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

// Load .env.local manually (no dotenv dependency required)
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    envPath2: {
      const fallback = path.join(process.cwd(), ".env");
      if (fs.existsSync(fallback)) {
        const txt = fs.readFileSync(fallback, "utf-8");
        for (const line of txt.split("\n")) {
          const m = line.match(/^([A-Z_]+)=(.*)$/);
          if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    }
    return;
  }
  const txt = fs.readFileSync(envPath, "utf-8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error("❌ KV credentials not found. Set KV_REST_API_URL + KV_REST_API_TOKEN");
  console.error("   (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) in .env.local");
  process.exit(1);
}

// Helper: call Upstash REST API
async function upstash(...args) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.result;
}

async function listKeys(pattern) {
  const keys = [];
  let cursor = "0";
  do {
    const result = await upstash("SCAN", cursor, "MATCH", pattern, "COUNT", "1000");
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== "0");
  return keys;
}

async function deleteKeys(keys) {
  // Delete in batches of 100 to avoid request size limits
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    await upstash("DEL", ...batch);
    deleted += batch.length;
    process.stdout.write(`\r   Deleted ${deleted}/${keys.length}...`);
  }
  process.stdout.write("\n");
  return deleted;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function main() {
  console.log("\n🔍 Scanning Reach.io KV namespace...\n");

  const allKeys = await listKeys("eb:*");
  console.log(`   Found ${allKeys.length} key(s) under eb:* namespace\n`);

  if (allKeys.length === 0) {
    console.log("✅ Nothing to delete. Database is already empty.\n");
    return;
  }

  // Group by category for visibility
  const groups = {};
  for (const key of allKeys) {
    const category = key.split(":")[1] || "other";
    groups[category] = (groups[category] || 0) + 1;
  }
  console.log("📊 Breakdown:");
  for (const [k, v] of Object.entries(groups).sort()) {
    console.log(`     • eb:${k}:* → ${v} key(s)`);
  }
  console.log("");

  console.log("⚠️  WARNING: This will permanently delete ALL the data above.");
  console.log("   This action CANNOT be undone.\n");

  const answer = await ask('   Type "WIPE EVERYTHING" to confirm: ');
  if (answer !== "WIPE EVERYTHING") {
    console.log("\n❌ Cancelled. No data was deleted.\n");
    return;
  }

  console.log("\n🗑️  Deleting...");
  const deleted = await deleteKeys(allKeys);
  console.log(`\n✅ Deleted ${deleted} key(s) from KV.\n`);

  console.log("📝 Next steps:");
  console.log("   1. Tell each user to clear browser data (or run in DevTools console):");
  console.log("        localStorage.clear(); sessionStorage.clear(); location.reload();");
  console.log("   2. Re-register to recreate accounts.\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
