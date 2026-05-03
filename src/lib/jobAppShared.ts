// Pure, isomorphic helpers + types for the job-mailer.
// Safe to import from both server and client (no fs / kv imports).

// ---------- Types ----------

export interface Template {
  id: string;
  name: string;
  roleType: string;
  subject: string;
  body: string;
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
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const v = ctx[key];
    return v && v !== "" ? v : `{${key}}`;
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

export function followUpsDue(history: SendRecord[], thresholdDays = 7): FollowUpEntry[] {
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

// Bump this whenever DEFAULT_TEMPLATES content changes — server will overwrite
// existing templates with the same name on next load.
export const TEMPLATES_SEED_VERSION = 3;

export const DEFAULT_TEMPLATES: Omit<Template, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Python Backend Developer",
    roleType: "python backend developer",
    subject: "Application for Python Backend Developer Role",
    body: `Dear Hiring Team,

I hope this message finds you well. I am writing to express my interest in Python Backend Developer opportunities on your team.

I currently work as a Software Developer at NETAI, where I build production backend services and real-time monitoring systems. A few highlights from my recent work:

- Designed and shipped a RADIUS (AAA) integration for centralised device authentication, authorisation, and accounting.
- Architected an end-to-end alerting pipeline (Alertmanager -> Kafka -> ClickHouse) for high-volume real-time alert processing and analytics.
- Built role-based and site-scoped access control for fine-grained, multi-tenant permissions.
- Developed real-time 2D network topology visualisations using FastAPI and WebSockets.

Stack: Python, FastAPI, Pydantic, SQLAlchemy, Apache Kafka, Redis, Celery, ClickHouse, MySQL, Prometheus, Docker.

In addition to my professional work, I have built personal projects such as a PDF Chatbot using FAISS and the Mistral model for retrieval-augmented question answering, and a Django-based carpooling platform with integrated payments.

I would value the opportunity to be considered for any suitable Python Backend Developer openings on your team. My resume is attached for your review, and I would welcome the chance to discuss how my experience aligns with your needs.

Thank you for your time and consideration.

Best regards,
Meet Patel
+91 8799474373 | meetpatel4384@gmail.com
LinkedIn: https://www.linkedin.com/in/meet-patel-34399b286/
GitHub:   https://github.com/Meetpatel2306
`,
  },
  {
    name: "AI / ML Developer",
    roleType: "ai ml developer",
    subject: "Application for AI / ML Developer Role",
    body: `Dear Hiring Team,

I hope this message finds you well. I am writing to express my interest in AI / ML Developer opportunities on your team.

My background combines production Python backend engineering with applied AI / ML, which I believe positions me well to ship real-world AI features:

- Designed and built an end-to-end RAG chatbot - PDF ingestion -> embeddings -> FAISS vector index -> context retrieval -> grounded answers via the Ollama Mistral LLM, with sub-second retrieval over multi-document corpora.
- At NETAI, I work on real-time data pipelines (Kafka, ClickHouse) - the same data infrastructure that modern ML platforms rely on for feature stores, telemetry, and model monitoring.
- Strong proficiency in Python, NumPy, Pandas, Pydantic, and FastAPI for ML-serving APIs, with hands-on experience in vector search, embeddings, prompt engineering, and integrating both local and hosted LLMs.

Currently exploring: LangChain, LlamaIndex, OpenAI and Anthropic APIs, evaluation frameworks, and embedding pipelines at scale.

I am seeking a role where I can contribute to building production AI features - including RAG systems, LLM-powered APIs, and ML data infrastructure - while continuing to grow into deeper ML and MLOps work.

My resume is attached for your review, and I would be glad to walk you through any of my projects in more detail or discuss how I can contribute to your team.

Thank you for your time and consideration.

Best regards,
Meet Patel
+91 8799474373 | meetpatel4384@gmail.com
LinkedIn: https://www.linkedin.com/in/meet-patel-34399b286/
GitHub:   https://github.com/Meetpatel2306
`,
  },
  {
    name: "Follow-Up (7 Days)",
    roleType: "follow up",
    subject: "Following Up on My Application",
    body: `Dear Hiring Team,

I hope you are doing well. I am following up on the application I shared earlier regarding open Developer positions on your team.

I remain very interested in the opportunity and would appreciate any update you can share on my application. I would be happy to provide additional details, code samples, or schedule a short call at your convenience.

Thank you again for your time and consideration.

Best regards,
Meet Patel
+91 8799474373 | meetpatel4384@gmail.com
LinkedIn: https://www.linkedin.com/in/meet-patel-34399b286/
GitHub:   https://github.com/Meetpatel2306
`,
  },
];
