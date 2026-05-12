#!/usr/bin/env node
/**
 * Sets up your 3 personal templates with the right resume PDFs baked in.
 *
 *   Template                              Resume file
 *   -----------------------------------   ---------------------------------------
 *   AI / ML Engineer (Trimmed MNC)        D:\Users\Meet\Desktop\automation\resume\Meet_Patel_Resume_v2.pdf  (NEW)
 *   Python Developer (Trimmed MNC)        D:\Users\Meet\Downloads\Meet Resume.pdf                          (OLD)
 *   Python Developer New                  D:\Users\Meet\Desktop\automation\resume\Meet_Patel_Resume_v2.pdf  (NEW)
 *
 * Usage:
 *   cd email-blaster
 *   node scripts/attach-resumes-to-templates.mjs
 *
 * Idempotent — re-runs safely. Creates the template row if missing, or just
 * updates the resume bytes if it already exists.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---------- env loader ----------
function loadEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();
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
  console.error("✗ Missing KV credentials in .env.local (KV_REST_API_URL + KV_REST_API_TOKEN).");
  process.exit(1);
}

// ---------- target ----------
const USER_EMAIL = "meetpatel4384@gmail.com";
const KEY = `eb:job:${USER_EMAIL}:templates`;

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

// Spec: name, body, role-type, the local PDF to bake in, and resumePath note.
const SPECS = [
  {
    name: "AI / ML Engineer (Trimmed MNC)",
    roleType: "ai ml engineer",
    subject: "Application for AI / ML Engineer Role",
    resumePath: "D:\\Users\\Meet\\Desktop\\automation\\resume",
    pdfPath: "D:\\Users\\Meet\\Desktop\\automation\\resume\\Meet_Patel_Resume_v2.pdf",
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
    pdfPath: "D:\\Users\\Meet\\Downloads\\Meet Resume.pdf",
    body: PYTHON_DEV_BODY,
  },
  {
    name: "Python Developer New",
    roleType: "python developer",
    subject: "Application for Python Developer Role",
    resumePath: "D:\\Users\\Meet\\Desktop\\automation\\resume",
    pdfPath: "D:\\Users\\Meet\\Desktop\\automation\\resume\\Meet_Patel_Resume_v2.pdf",
    body: PYTHON_DEV_BODY,
  },
];

// ---------- Upstash REST helpers ----------
function deepParse(raw) {
  let v = raw;
  for (let i = 0; i < 3; i++) {
    if (typeof v !== "string") return v;
    const tt = v.trim();
    if (!tt.startsWith("{") && !tt.startsWith("[") && !tt.startsWith('"')) return v;
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
  const d = await kvCommand(["GET", key]);
  if (d.result == null) return null;
  return deepParse(d.result);
}

async function kvSet(key, value) {
  return await kvCommand(["SET", key, JSON.stringify(value)]);
}

// ---------- file helpers ----------
function resolveResumeFile(preferred) {
  if (fs.existsSync(preferred)) return preferred;
  const dir = path.dirname(preferred);
  if (!fs.existsSync(dir)) return null;
  const candidates = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".pdf"));
  if (!candidates.length) return null;
  return path.join(dir, candidates[0]);
}

function fileToDataURL(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    base64: `data:application/pdf;base64,${bytes.toString("base64")}`,
    size: bytes.length,
    name: path.basename(filePath),
  };
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
  const list = (await kvGet(KEY)) || [];
  if (!Array.isArray(list)) throw new Error(`Unexpected templates shape: ${typeof list}`);

  console.log(`  Currently in KV: ${list.length} template(s)`);
  for (const t of list) console.log(`    • ${t.name}`);

  // Pre-read each PDF
  const pdfs = {};
  console.log("\n▶ Reading resume PDFs from disk...");
  for (const spec of SPECS) {
    const resolved = resolveResumeFile(spec.pdfPath);
    if (!resolved) {
      console.error(`  ✗ Missing PDF for "${spec.name}" at ${spec.pdfPath}`);
      continue;
    }
    const meta = fileToDataURL(resolved);
    pdfs[spec.name] = { ...meta, resolvedPath: resolved };
    console.log(`  ✓ ${spec.name} ← ${resolved} (${(meta.size / 1024).toFixed(0)} KB)`);
  }

  // Merge / upsert each spec into the list
  const now = nowIso();
  let created = 0;
  let updated = 0;
  for (const spec of SPECS) {
    const pdf = pdfs[spec.name];
    if (!pdf) continue;
    const existingIdx = list.findIndex((t) => t.name === spec.name);
    const base = {
      name: spec.name,
      roleType: spec.roleType,
      subject: spec.subject,
      body: spec.body,
      resumePath: spec.resumePath,
      resumeName: pdf.name,
      resumeBase64: pdf.base64,
      resumeSize: pdf.size,
    };
    if (existingIdx === -1) {
      list.push({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        ...base,
      });
      created++;
    } else {
      list[existingIdx] = {
        ...list[existingIdx],
        ...base,
        updatedAt: now,
      };
      updated++;
    }
  }

  if (created + updated === 0) {
    console.error("\n✗ Nothing applied — check the spec names match exactly.");
    process.exit(2);
  }

  await kvSet(KEY, list);
  const sizeKb = (JSON.stringify(list).length / 1024).toFixed(0);
  console.log(`\n✓ Done. Created ${created}, updated ${updated}. Total in KV: ${list.length} (${sizeKb} KB).`);
  console.log("\nOpen https://email-blaster-orpin.vercel.app/templates — each personal template now shows a green “Resume attached” badge.");
}

main().catch((e) => {
  console.error("\n✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
