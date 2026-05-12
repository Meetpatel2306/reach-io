#!/usr/bin/env node
/**
 * One-off script: adds 3 personal templates to the KV store under
 * meetpatel4384@gmail.com — does NOT modify the seed templates that
 * ship to other users.
 *
 * Usage:
 *   cd email-blaster
 *   node scripts/add-meet-templates.mjs
 *
 * Reads KV credentials from .env.local (KV_REST_API_URL + KV_REST_API_TOKEN,
 * or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 *
 * Behaviour:
 *   - Loads the existing template list (key: eb:job:<email>:templates).
 *   - Skips any template whose `name` already exists in the list (idempotent).
 *   - Appends only the missing ones.
 *   - Writes the updated list back.
 *
 * Safe to re-run.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---------- env loader (no dotenv dep needed) ----------
function loadEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  const raw = fs.readFileSync(full, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!KV_URL || !KV_TOKEN) {
  console.error("✗ Missing KV credentials. Need KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN) in .env.local.");
  process.exit(1);
}

// ---------- target ----------
const USER_EMAIL = "meetpatel4384@gmail.com";
const KEY = `eb:job:${USER_EMAIL}:templates`;

// ---------- new templates ----------
const PYTHON_DEV_BODY = `Dear Hiring Team,

I hope this message finds you well. I am writing to express my interest in Python Developer opportunities on your team.

I currently work as a Software Developer at NETAI, where I design and ship production backend services in Python and FastAPI. My recent work includes a RADIUS (AAA) integration for centralised authentication, authorisation, and accounting, with the accounting pipeline flowing into ClickHouse. I have architected an end-to-end real-time alerting pipeline (Alertmanager → Apache Kafka → idempotent Python consumers → ClickHouse) achieving sub-5-second end-to-end latency, sustaining thousands of alerts per day, and built role-based, site-scoped access control for fine-grained multi-tenant permissions across the platform.

My core stack includes Python, FastAPI, Pydantic, Django, SQLAlchemy, Apache Kafka, Redis, Celery, ClickHouse, MySQL, Nginx, Docker, Prometheus, and Git. Side projects include a RAG chatbot built with FAISS and Mistral, a Django carpooling platform with Razorpay payments, and a production-grade music streaming PWA with a custom recommendation engine.

My resume is attached for your review, and I would welcome the chance to discuss how my experience aligns with your requirements.

Thank you for your time and consideration.

Best regards,
Meet Patel
+91 8799474373 | meetpatel4384@gmail.com
LinkedIn: https://www.linkedin.com/in/meet-patel-34399b286/
GitHub: https://github.com/Meetpatel2306
`;

const TEMPLATES_TO_ADD = [
  {
    name: "AI / ML Engineer (Trimmed MNC)",
    roleType: "ai ml engineer",
    subject: "Application for AI / ML Engineer Role",
    resumePath: "D:\\Users\\Meet\\Desktop\\automation\\resume",
    body: `Dear Hiring Team,

I hope this message finds you well. I am writing to express my interest in AI / ML Engineer opportunities on your team.

I currently work as a Python backend developer at NETAI, where I have spent the past year combining production Python engineering with applied AI work. I have designed and built an end-to-end Retrieval-Augmented Generation chatbot that ingests PDFs, indexes embeddings in FAISS, and serves grounded answers through the Ollama Mistral LLM, with sub-second similarity search across multi-document corpora. At NETAI, I architect real-time data pipelines using Apache Kafka and ClickHouse — the same class of infrastructure that modern ML platforms rely on for feature stores, telemetry, and model monitoring.

My core stack includes Python, FastAPI, NumPy, Pandas, FAISS, and Ollama (Mistral), with hands-on experience in vector search, embeddings, prompt engineering, and integrating local and hosted LLMs. I am certified in Python for Data Science (NPTEL) and currently extending into LangChain, LlamaIndex, and the OpenAI and Anthropic APIs.

My resume is attached for your review, and I would welcome the chance to discuss how my experience aligns with your requirements.

Thank you for your time and consideration.

Best regards,
Meet Patel
+91 8799474373 | meetpatel4384@gmail.com
LinkedIn: https://www.linkedin.com/in/meet-patel-34399b286/
GitHub: https://github.com/Meetpatel2306
`,
  },
  {
    name: "Python Developer (Trimmed MNC)",
    roleType: "python developer",
    subject: "Application for Python Developer Role",
    resumePath: "D:\\Users\\Meet\\Downloads",
    body: PYTHON_DEV_BODY,
  },
  {
    name: "Python Developer New",
    roleType: "python developer",
    subject: "Application for Python Developer Role",
    resumePath: "D:\\Users\\Meet\\Desktop\\automation\\resume",
    body: PYTHON_DEV_BODY,
  },
];

// ---------- Upstash REST helpers (command-style endpoint) ----------
// Robust against double-stringification: if the first JSON.parse yields a
// string that itself looks like JSON, parse it again.
function deepParse(raw) {
  let v = raw;
  for (let i = 0; i < 3; i++) {
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (!t.startsWith("{") && !t.startsWith("[") && !t.startsWith('"')) return v;
    try { v = JSON.parse(v); } catch { return v; }
  }
  return v;
}

async function kvCommand(command) {
  const r = await fetch(KV_URL.replace(/\/+$/, ""), {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`KV ${command[0]} ${command[1]}: ${r.status} ${await r.text()}`);
  return await r.json();
}

async function kvGet(key) {
  const data = await kvCommand(["GET", key]);
  if (data.result == null) return null;
  return deepParse(data.result);
}

async function kvSet(key, value) {
  // Upstash command-style SET expects the value as a single JSON string.
  return await kvCommand(["SET", key, JSON.stringify(value)]);
}

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function nowIso() {
  return new Date().toISOString();
}

// ---------- main ----------
async function main() {
  console.log(`▶ Loading templates for ${USER_EMAIL}...`);
  let existing = (await kvGet(KEY)) || [];
  if (!Array.isArray(existing)) {
    // One more parse attempt — the previous bad script ran one JSON.stringify too many.
    if (typeof existing === "string") {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed)) {
          console.log("  (Recovered double-stringified data from previous bad write — rewriting cleanly.)");
          existing = parsed;
          await kvSet(KEY, existing); // normalise it back
        } else {
          throw new Error(`Stored value is a string but not a JSON array: ${existing.slice(0, 80)}…`);
        }
      } catch (e) {
        throw new Error(`Unexpected templates shape (string, unrecoverable): ${e instanceof Error ? e.message : e}`);
      }
    } else {
      throw new Error(`Unexpected templates shape: ${typeof existing}`);
    }
  }
  console.log(`  ${existing.length} template(s) already present:`);
  for (const t of existing) console.log(`    • ${t.name}`);

  const existingNames = new Set(existing.map((t) => t.name));
  const toAdd = TEMPLATES_TO_ADD.filter((t) => !existingNames.has(t.name));

  if (toAdd.length === 0) {
    console.log("\n✓ Nothing to do — all 3 personal templates already exist by name. (Re-run after deleting duplicates if you want a fresh copy.)");
    return;
  }

  console.log(`\n▶ Adding ${toAdd.length} new template(s):`);
  const now = nowIso();
  const newOnes = toAdd.map((t) => ({
    ...t,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }));
  for (const t of newOnes) console.log(`    + ${t.name}  (resumePath: ${t.resumePath})`);

  const merged = [...existing, ...newOnes];
  await kvSet(KEY, merged);

  console.log(`\n✓ Done. Total templates now: ${merged.length}`);
  console.log("\nOpen https://email-blaster-orpin.vercel.app/templates to see them.");
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
