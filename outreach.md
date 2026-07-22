# Outreach Kit — Meet Patel

Fill in `[BRACKETS]`. Never send with a bracket left in it.

Your one differentiator, used in every message below: **you have shipped an LLM agent
that runs in production.** Almost every other candidate with ~1 year of experience has
shipped a tutorial. Lead with that, every time.

---

## RULES (these matter more than the wording)

1. **Never send to `hr@`, `careers@`, or `info@`.** Those addresses are where resumes
   go to die. Find a person on LinkedIn — recruiter, engineering lead, or CTO.
2. **At a startup (<100 people), email the engineering lead or CTO, not HR.** Highest
   response rate of any channel available to you.
3. **Line 1 must be personalised.** Their product, a blog post, a talk, the specific
   open role. If you cannot write that line, do not send the email.
4. **Rename the attachment.** `ai.pdf` looks like spam. Use
   `Meet_Patel_AI_Engineer.pdf` (a copy is already saved next to your resume).
5. **Send Tuesday–Thursday, 9:30–11:00 AM IST.** Monday and Friday get buried.
6. **One follow-up. Ever.** Six days later. Then stop.
7. **15–20 targeted sends per week beats 200 cold ones.** You have already run the
   200-cold experiment; it returned zero. Do not run it again.
8. **Apply within 48 hours of a job posting going live.** After a week the pile is
   too deep to matter.

---

## 0. REPLACEMENTS for the templates you were actually sending

Your old ones were ~250-word cover letters with the subject line
"Application for [Role]", opening "Dear Hiring Team / I hope this message finds you
well", and zero personalisation. That is almost certainly the main cause of 200 sends
returning 0 replies. These are the drop-in replacements.

Two lines are permanently retired:

- "I currently work as a Python backend developer" — never open an AI application by
  labelling yourself as not an AI engineer.
- "currently extending into LangChain, LlamaIndex, and the OpenAI and Anthropic APIs" —
  **this is false and it is costing you interviews.** The mcp-chatbot code imports
  `langchain_core` in 28 places plus `langchain_openai`, `langchain_anthropic` and
  `langchain_google`. You use all of it in production. Say so.

### 0a. AI Engineer

> **Subject:** AI Engineer — production LLM agent over 30+ tools

Hi [NAME],

[ONE LINE ABOUT THEM — their product, a post, the specific role.]

I build LLM agents that run in production, not demos. At NETAI I own our
network-operations agent: a ReAct loop that plans over 30+ typed tools served through
MCP servers, streams results to the UI over SSE, and runs against OpenAI, Anthropic,
Gemini and a self-hosted Mistral behind one interface. I also built the FAISS RAG
pipeline and the FastAPI/Kafka/ClickHouse backend underneath it.

A year of this, and I'd like to do it somewhere the agent *is* the product.

Are you hiring? Resume attached.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286

### 0b. Python Developer

> **Subject:** Python/FastAPI engineer — Kafka→ClickHouse at sub-5s latency

Hi [NAME],

[ONE LINE ABOUT THEM.]

I'm a backend engineer at NETAI. Two systems I own:

- A real-time alerting pipeline — Alertmanager → Kafka → idempotent Python consumers →
  ClickHouse — sustaining thousands of alerts/day at sub-5-second end-to-end latency,
  with live WebSocket push to the ops UI.
- A centralised RADIUS (AAA) service, plus site-scoped RBAC for multi-tenant permissions
  across the platform.

I've also written a TR-069/CWMP auto-configuration server from scratch and an
Ed25519-signed offline licensing system.

Are you hiring for backend? Resume attached.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286

*(BeatStream and URide dropped — the ACS and licensing systems are harder and land better.)*

### Phrases to never send again

| Cut | Why |
|---|---|
| "Application for [Role] Role" as a subject | Identical to 400 others; nothing to open |
| "Dear Hiring Team" | Signals mass-blast in three words |
| "I hope this message finds you well" | Filler; marks the email as a template |
| "I would welcome the chance to discuss how my experience aligns with your requirements" | 16 words, no content, no ask |
| "Thank you for your time and consideration" | Filler |
| "currently extending into [tech you already use]" | Understates you and is untrue |

---

## A. Recruiter / HR — specific open role

> **Subject:** [ROLE TITLE] — Meet Patel, production LLM agent experience

Hi [NAME],

I'm applying for the [ROLE TITLE] role at [COMPANY].

I'm a Python engineer at NETAI in Ahmedabad. For the past year I've built LLM systems
that run in production rather than demos:

- A ReAct agent that answers live infrastructure questions by planning over 30+ typed
  tools served through Model Context Protocol (MCP) servers — LangChain, streaming
  responses, with OpenAI, Anthropic, Gemini and a self-hosted Mistral behind one interface.
- A Retrieval-Augmented Generation pipeline on FAISS with a self-hosted model, plus the
  FastAPI, Kafka and ClickHouse backend both of them run on.

Resume attached. Happy to walk through the agent's architecture on a call.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286

---

## B. Engineering lead / CTO — cold, no posted role

Use this at startups. It is your highest-yield template.

> **Subject:** Production MCP tool-calling agent — interested in [COMPANY]

Hi [NAME],

[ONE SPECIFIC LINE: "I read your post on X", "I've been using [PRODUCT]", "saw you're
building Y".] Reaching out to you directly rather than through the portal.

I'm a Python engineer at NETAI. I built our network-operations agent end to end: a ReAct
loop over 30+ typed, read-only tools exposed through MCP servers, with per-device
concurrency limits, step budgets, and results streamed to the UI over Server-Sent Events.
I also wrote the RAG pipeline and the FastAPI/Kafka/ClickHouse backend underneath it.

About a year on this, and I'd like to do it somewhere the agent *is* the product.

If you're hiring for LLM or agent work, could I have 15 minutes? Resume attached.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286

---

## C. LinkedIn connection request (300-character limit)

Hi [NAME] — Python engineer at NETAI, Ahmedabad. Built a production ReAct agent over 30+
tools served through MCP servers (LangChain, streaming, multi-provider). Keen on the
LLM/agent work at [COMPANY]. Would like to connect.

*(215 characters. Do not attach anything. Do not pitch yet.)*

---

## D. LinkedIn DM — send 1 day after they accept

Thanks for connecting, [NAME].

Quick context in case it's useful: at NETAI I built a production LLM agent — a ReAct loop
planning over 30+ typed tools served through MCP servers, streamed to the UI, with
OpenAI/Anthropic/Gemini/self-hosted Mistral behind one interface. Also the RAG pipeline
and the FastAPI + Kafka + ClickHouse backend under it.

I'm looking for LLM/agent engineering roles. Is [COMPANY] hiring, or could you point me
to whoever owns that team?

Either way, thanks for the connect.

---

## E. Referral request — batchmate, senior, or LDRP alum

Highest-conversion message in this file. Send it to everyone you actually know.

Hi [NAME], hope you're doing well.

I'm looking to move into LLM/agent engineering, and I saw [COMPANY] has an opening for
[ROLE]. Would you be comfortable referring me?

For context: I'm at NETAI, and this past year I built a production ReAct agent over 30+
tools served through MCP servers, a FAISS RAG pipeline on a self-hosted model, and the
FastAPI/Kafka/ClickHouse backend for both.

Resume attached — completely fine if you'd rather not, no pressure at all.

Thanks!
Meet

---

## F. Follow-up — day 6, once only

> **Subject:** Re: [ORIGINAL SUBJECT LINE]  ← reply in the same thread, don't start new

Hi [NAME],

Following up on the note below in case it got buried.

Short version: a year building production LLM agents — MCP tool-calling, RAG, and the
FastAPI/Kafka/ClickHouse backend underneath. Still very interested in [COMPANY].

If it isn't a fit right now, no problem at all — just let me know and I'll stop nudging.

Thanks,
Meet

---

## What to change before sending any of these

- [ ] GitHub bio: "Python Backend Developer" → match your resume title. It's a 60-second
      edit and every recruiter clicks the link.
- [ ] Pin your 6 strongest repos on GitHub. Right now it auto-shows `tic-tac-toe` and
      `Textutils`, which undercuts everything the resume claims.
- [ ] Attach `Meet_Patel_AI_Engineer.pdf`, not `ai.pdf`.
