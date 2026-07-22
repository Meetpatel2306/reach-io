// Pure, isomorphic helpers + types for the job-mailer.
// Safe to import from both server and client (no fs / kv imports).

// ---------- Types ----------

export interface Template {
  id: string;
  name: string;
  roleType: string;
  subject: string;
  body: string;
  // Optional reminder of which local folder / file holds the resume that
  // pairs with this template. Pure note for the user — server has no access
  // to local paths. Used to remind them which PDF to attach when sending.
  resumePath?: string;
  // Optional baked-in resume — upload once, lives with the template.
  // When the template is loaded into the compose step, the resume auto-attaches.
  resumeName?: string;
  resumeBase64?: string; // dataURL
  resumeSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  email: string;
  name: string;
  company: string;
  role: string;
  custom1?: string;
  custom2?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeMeta {
  id: string;
  label: string;
  roleType: string;
  filename: string;
  storedFilename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface SendRecord {
  id: string;
  status: "sent" | "failed";
  sentAt: string;
  contactId: string;
  contactEmail: string;
  contactName: string;
  company: string;
  role: string;
  templateId: string;
  templateName: string;
  resumeId: string | null;
  resumeLabel: string;
  subject: string;
  body: string;
  isFollowUp: boolean;
  followUpDone: boolean;
  // RFC-2822 Message-ID + Gmail thread id of the sent message — lets the
  // one-click follow-up reply inside the same thread instead of starting a new one.
  messageId?: string;
  threadId?: string;
  error?: string;
}

export interface FollowUpEntry extends SendRecord {
  daysSinceSent: number;
}

export interface Slot {
  id: string;
  name: string;
  subject: string;
  body: string;
  resumeName: string;       // original PDF filename
  resumeBase64: string;     // dataURL — survives cross-device because it's stored server-side
  resumeSize: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- ID + time ----------

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---------- Placeholder rendering ----------

const PLACEHOLDER = /\{(\w+)\}/g;

export function deriveFirstName(fullName: string | undefined, email: string | undefined): string {
  if (fullName && fullName.trim()) return fullName.trim().split(/\s+/)[0];
  if (email) {
    const local = email.split("@")[0];
    const head = local.split(/[._\-]/)[0];
    return head ? head[0].toUpperCase() + head.slice(1) : "Hiring Team";
  }
  return "Hiring Team";
}

export interface ContextInput {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  custom1?: string;
  custom2?: string;
}

export function buildContext(c: ContextInput): Record<string, string> {
  return {
    name: c.name || "Hiring Team",
    first_name: deriveFirstName(c.name, c.email),
    company: c.company || "",
    role: c.role || "",
    custom1: c.custom1 || "",
    custom2: c.custom2 || "",
  };
}

export function render(text: string, ctx: Record<string, string>): string {
  if (!text) return "";
  return text.replace(PLACEHOLDER, (whole, key: string) => {
    // Only substitute keys we actually know about; leave unknown tokens as-is.
    if (!(key in ctx)) return whole;
    // For a known-but-empty value (e.g. recipient has no company/role), drop the
    // token instead of printing a literal "{company}" into the email.
    return ctx[key] || "";
  });
}

// ---------- Suggestions ----------

function tokens(s: string | undefined): string[] {
  return (s || "").toLowerCase().replace(/[\/\-]/g, " ").split(/\s+/).filter(Boolean);
}

function score(roleType: string, role: string): number {
  if (!roleType || !role) return 0;
  const rtTokens = tokens(roleType);
  const rTokens = new Set(tokens(role));
  let s = 0;
  for (const t of rtTokens) if (rTokens.has(t)) s++;
  return s;
}

export function suggestTemplate(role: string, templates: Template[]): Template | null {
  let best: Template | null = null;
  let bestScore = 0;
  for (const t of templates) {
    if ((t.roleType || "").toLowerCase().includes("follow")) continue;
    const s = score(t.roleType, role);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  return best;
}

export function suggestResume(role: string, resumes: ResumeMeta[]): ResumeMeta | null {
  let best: ResumeMeta | null = null;
  let bestScore = 0;
  for (const r of resumes) {
    const s = score(r.roleType, role);
    if (s > bestScore) { bestScore = s; best = r; }
  }
  return best;
}

// ---------- Follow-ups ----------

// Day 6 is the follow-up day: one follow-up, ever, then stop.
export const FOLLOW_UP_DAY = 6;

export function followUpsDue(history: SendRecord[], thresholdDays = FOLLOW_UP_DAY): FollowUpEntry[] {
  const latestByEmail = new Map<string, SendRecord>();
  for (const r of history) {
    if (r.status !== "sent") continue;
    const prev = latestByEmail.get(r.contactEmail);
    if (!prev || r.sentAt > prev.sentAt) latestByEmail.set(r.contactEmail, r);
  }
  const due: FollowUpEntry[] = [];
  const now = Date.now();
  for (const r of latestByEmail.values()) {
    if (r.isFollowUp || r.followUpDone) continue;
    const days = Math.floor((now - new Date(r.sentAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days >= thresholdDays) due.push({ ...r, daysSinceSent: days });
  }
  due.sort((a, b) => b.daysSinceSent - a.daysSinceSent);
  return due;
}

export function alreadyContacted(history: SendRecord[], email: string, withinDays = 14): SendRecord[] {
  const e = email.toLowerCase();
  const cutoff = Date.now() - withinDays * 86400000;
  return history
    .filter((r) => r.status === "sent" && r.contactEmail.toLowerCase() === e && new Date(r.sentAt).getTime() >= cutoff)
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

// ---------- Default templates (used by server seeder) ----------

// Bump this whenever DEFAULT_TEMPLATES content changes — server migration runs
// on next load (see migrateTemplatesIfNeeded in jobApp.ts).
export const TEMPLATES_SEED_VERSION = 6;

// Names of retired templates removed by the v5 migration. The old bodies opened
// "Dear Hiring Team / I hope this message finds you well" — the exact pattern
// that returned 0 replies from 200 sends. The follow-up template is retired too:
// follow-ups are now sent threaded from the Follow-ups panel, not as new emails.
export const RETIRED_TEMPLATE_NAMES = [
  "Python Backend Developer",
  "AI / ML Developer",
  "Follow-Up (7 Days)",
];

export const DEFAULT_TEMPLATES: Omit<Template, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "AI Engineer",
    // Rich keyword list — template auto-suggestion scores these tokens against
    // the role title, so cover every phrasing recruiters actually use.
    roleType: "ai ml machine learning engineer developer llm genai generative agent agentic rag nlp data scientist deep prompt langchain python artificial intelligence",
    subject: "AI Engineer — production LLM agent over 30+ tools",
    body: `Hi {first_name},

{custom1}

I build LLM agents that run in production, not demos. At NETAI I own our network-operations agent: a ReAct loop that plans over 30+ typed tools served through MCP servers, streams results to the UI over SSE, and runs against OpenAI, Anthropic, Gemini and a self-hosted Mistral behind one interface. I also built the FAISS RAG pipeline and the FastAPI/Kafka/ClickHouse backend underneath it.

A year of this, and I'd like to do it somewhere the agent is the product.

Are you hiring? Resume attached.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286
`,
  },
  {
    name: "Python Developer",
    roleType: "python backend developer engineer fastapi django flask api server sde software fullstack full stack web services microservices kafka data",
    subject: "Python/FastAPI engineer — Kafka→ClickHouse at sub-5s latency",
    body: `Hi {first_name},

{custom1}

I'm a backend engineer at NETAI. Two systems I own:

- A real-time alerting pipeline — Alertmanager → Kafka → idempotent Python consumers → ClickHouse — sustaining thousands of alerts/day at sub-5-second end-to-end latency, with live WebSocket push to the ops UI.
- A centralised RADIUS (AAA) service, plus site-scoped RBAC for multi-tenant permissions across the platform.

I've also written a TR-069/CWMP auto-configuration server from scratch and an Ed25519-signed offline licensing system.

Are you hiring for backend? Resume attached.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286
`,
  },
];
