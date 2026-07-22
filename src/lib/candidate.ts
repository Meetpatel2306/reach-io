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

// The fixed body the app renders around the AI's hook + project pick.
// The AI never sees or writes this.
export function renderOutreachBody(opts: {
  recipientFirstName: string;
  hook: string;
  leadProject: CandidateProject;
  secondProject?: CandidateProject | null;
}): string {
  const second = opts.secondProject && opts.secondProject.id !== opts.leadProject.id
    ? `\nI also built ${opts.secondProject.summary}.`
    : "";
  return `Hi ${opts.recipientFirstName},

${opts.hook}

I build systems that run in production, not demos. At NETAI I own ${opts.leadProject.summary}.${second}

About a year of this, and I'd like to do it somewhere it's the core of the product.

If you're hiring, could I have 15 minutes?

${SIGNATURE}
Resume attached.`;
}

// Fixed follow-up copy (outreach kit, section F). Sent as a reply in the same
// thread — subject becomes "Re: <original subject>".
export function renderFollowUpBody(opts: { recipientFirstName: string; company: string }): string {
  const company = opts.company ? opts.company : "your team";
  return `Hi ${opts.recipientFirstName},

Following up on the note below in case it got buried.

Short version: a year building production LLM agents — MCP tool-calling, RAG, and the FastAPI/Kafka/ClickHouse backend underneath. Still very interested in ${company}.

If it isn't a fit right now, no problem at all — just let me know and I'll stop nudging.

Thanks,
Meet`;
}

// Generic inboxes are where resumes go to die — hard-block them.
export const GENERIC_INBOX = /^(hr|careers?|info|jobs?|contact|admin|support|hello|recruitment|recruiting)@/i;
