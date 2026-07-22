// The single source of truth about the candidate. The AI may only SELECT from
// this — it never invents facts. The app renders the final email body itself
// from a fixed template, so every claim in every email stays true.

export interface CandidateProject {
  id: string;
  summary: string;
  tags: string[];
}

export const CANDIDATE_FACTS = {
  name: "Meet Patel",
  location: "Ahmedabad, India",
  current_role: "Software Developer, NETAI",
  experience: "about one year of professional experience",
  projects: [
    {
      id: "mcp_agent",
      summary:
        "a production ReAct agent that plans over 30+ typed tools served through Model Context Protocol servers, streams results to the UI over SSE, and runs against OpenAI, Anthropic, Gemini and a self-hosted Mistral behind one interface",
      tags: ["llm", "agents", "mcp", "langchain", "tool-calling", "streaming"],
    },
    {
      id: "rag_pdf",
      summary:
        "a Retrieval-Augmented Generation pipeline that chunks and embeds PDFs into a FAISS index and serves grounded multi-document answers through FastAPI with a self-hosted Mistral",
      tags: ["rag", "vector-search", "embeddings", "faiss", "ollama"],
    },
    {
      id: "alerting",
      summary:
        "a real-time alerting pipeline streaming Alertmanager events through Kafka to Python consumers and into ClickHouse at sub-5-second end-to-end latency, sustaining thousands of alerts per day",
      tags: ["backend", "kafka", "clickhouse", "streaming", "realtime", "scale"],
    },
    {
      id: "acs",
      summary:
        "a TR-069/CWMP auto-configuration server built from scratch that terminates CWMP sessions from CPE routers and collects full parameter trees into ClickHouse",
      tags: ["backend", "protocols", "soap", "fastapi", "from-scratch"],
    },
    {
      id: "licensing",
      summary:
        "an air-gapped licensing platform using signed offline bundles bound to a hardware fingerprint, with encrypted key storage and tamper detection",
      tags: ["backend", "security", "cryptography", "fastapi"],
    },
    {
      id: "rbac",
      summary:
        "site-scoped role-based access control giving fine-grained multi-tenant authorization across the platform",
      tags: ["backend", "auth", "multi-tenant"],
    },
  ] as CandidateProject[],
  stack: [
    "Python", "FastAPI", "Django", "LangChain", "MCP", "FAISS", "Kafka",
    "ClickHouse", "Redis", "Celery", "PostgreSQL", "MySQL", "Docker", "Nginx", "Prometheus",
  ],
  education: "B.E. Information Technology, LDRP Institute of Technology & Research, 2025",
};

export const SIGNATURE = `Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286`;

export function getProject(id: string): CandidateProject | null {
  return CANDIDATE_FACTS.projects.find((p) => p.id === id) || null;
}

// Words that are inbox labels, not human names — never greet these.
const GENERIC_NAME_TOKENS = new Set([
  "hr", "hiring", "careers", "career", "jobs", "job", "info", "contact",
  "admin", "team", "recruit", "recruiter", "recruiting", "recruitment",
  "talent", "support", "hello", "office", "mail", "email", "noreply", "no-reply",
]);

// A first name safe to open an email with, or null when we don't really know
// one (generic inbox, digits-only local part, "HR Team", ...). Callers render
// "Hi <name>," when non-null and a plain "Hello," otherwise — never "Hi Hr1,".
export function politeFirstName(fullName?: string, email?: string): string | null {
  const fromName = (fullName || "").trim().split(/\s+/)[0] || "";
  const fromEmail = email ? email.split("@")[0].split(/[._\-+]/)[0] : "";
  const candidate = fromName || fromEmail;
  const cleaned = candidate.replace(/[^a-zA-Z]/g, "");
  if (cleaned.length < 2) return null;
  if (GENERIC_NAME_TOKENS.has(cleaned.toLowerCase())) return null;
  return cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
}

export function greetingLine(fullName?: string, email?: string): string {
  const name = politeFirstName(fullName, email);
  return name ? `Hi ${name},` : "Hello,";
}

// The fixed body the app renders around the AI's hook + project pick.
// The AI never sees or writes this.
export function renderOutreachBody(opts: {
  recipientName?: string;
  recipientEmail?: string;
  hook: string;
  leadProject: CandidateProject;
  secondProject?: CandidateProject | null;
}): string {
  const second = opts.secondProject && opts.secondProject.id !== opts.leadProject.id
    ? `\nI also built ${opts.secondProject.summary}.`
    : "";
  return `${greetingLine(opts.recipientName, opts.recipientEmail)}

${opts.hook}

I build systems that run in production, not demos. At NETAI I own ${opts.leadProject.summary}.${second}

About a year of this, and I'd like to do it somewhere it's the core of the product.

If you're hiring, could I have 15 minutes?

${SIGNATURE}
Resume attached.`;
}

// The two role-positioned formats from the outreach kit (sections 0a / 0b).
// Same contract as renderOutreachBody: the AI supplies only the hook — every
// other sentence is fixed and true.
export type EmailFormat = "ai" | "backend" | "fixed";

export function renderRoleTemplateBody(format: "ai" | "backend", opts: {
  recipientName?: string;
  recipientEmail?: string;
  hook: string;
}): string {
  const greeting = greetingLine(opts.recipientName, opts.recipientEmail);
  if (format === "ai") {
    return `${greeting}

${opts.hook}

I build LLM agents that run in production, not demos. At NETAI I own our network-operations agent: a ReAct loop that plans over 30+ typed tools served through MCP servers, streams results to the UI over SSE, and runs against OpenAI, Anthropic, Gemini and a self-hosted Mistral behind one interface. I also built the FAISS RAG pipeline and the FastAPI/Kafka/ClickHouse backend underneath it.

A year of this, and I'd like to do it somewhere the agent is the product.

Are you hiring? Resume attached.

${SIGNATURE}`;
  }
  return `${greeting}

${opts.hook}

I'm a backend engineer at NETAI. Two systems I own:

- A real-time alerting pipeline — Alertmanager → Kafka → idempotent Python consumers → ClickHouse — sustaining thousands of alerts/day at sub-5-second end-to-end latency, with live WebSocket push to the ops UI.
- A centralised RADIUS (AAA) service, plus site-scoped RBAC for multi-tenant permissions across the platform.

I've also written a TR-069/CWMP auto-configuration server from scratch and an Ed25519-signed offline licensing system.

Are you hiring for backend? Resume attached.

${SIGNATURE}`;
}

// AI-focused projects lead with the AI Engineer positioning; everything else
// leads with the backend positioning.
const AI_PROJECT_IDS = new Set(["mcp_agent", "rag_pdf"]);

export function pickFormatForProject(leadProjectId: string): "ai" | "backend" {
  return AI_PROJECT_IDS.has(leadProjectId) ? "ai" : "backend";
}

// Fixed follow-up copy — professional register. Sent as a reply in the same
// thread; subject becomes "Re: <original subject>".
export function renderFollowUpBody(opts: {
  recipientName?: string;
  recipientEmail?: string;
  company?: string;
  role?: string;
}): string {
  const greeting = greetingLine(opts.recipientName, opts.recipientEmail);
  const about = opts.role
    ? ` regarding the ${opts.role} position${opts.company ? ` at ${opts.company}` : ""}`
    : opts.company
      ? ` I sent to ${opts.company}`
      : "";
  const interest = opts.company ? opts.company : "the opportunity";
  return `${greeting}

I wanted to follow up on my earlier email${about}, in case it got buried.

A quick recap: over the past year at NETAI I have built production LLM systems — an MCP tool-calling agent, a Retrieval-Augmented Generation pipeline, and the FastAPI/Kafka/ClickHouse backend underneath them. I remain very interested in ${interest}.

If the timing isn't right, no problem at all — a short note either way would be much appreciated.

Best regards,
${SIGNATURE}`;
}

// Generic inboxes are where resumes go to die — hard-block them.
export const GENERIC_INBOX = /^(hr|careers?|info|jobs?|contact|admin|support|hello|recruitment|recruiting)@/i;
