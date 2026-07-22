# Outreach Playbook — Meet Patel (Reach.io)

This file matches what the app actually does now. Two ways to write an email,
one rule for which resume goes with which, and a one-click follow-up.

Your one differentiator, used in every message: **you have shipped an LLM agent
that runs in production.** Almost every other candidate with ~1 year of
experience has shipped a tutorial. Lead with that, every time.

---

## 1. The two modes (Step 2 in the app)

| Mode | When to use | What happens |
|---|---|---|
| **✨ AI writes it (Dynamic)** — recommended | You have the job description | Gemini (Groq backup) reads the JD, writes the subject + a company-specific hook, picks your best-matching project, and renders the draft in the right template format. You review and edit before sending. |
| **📄 My templates (Static)** | No JD available, or quick sends | Pick "AI Engineer" or "Python Developer", the app fills the greeting from the recipient's name. `{custom1}` is your personalised first line — write one per recipient or leave it out. |

The AI refuses to draft when it can't do a good job: generic inbox (hr@…),
already-contacted person, company contacted in the last 30 days, more than 20
sends today, or a boilerplate JD with nothing company-specific to hook onto.
That refusal is protecting your reply rate — don't fight it, find a better
contact or a fuller JD.

---

## 2. Resume selection — one simple rule

**Two positionings. The role decides, not you:**

| The role is… | Template | Resume to attach |
|---|---|---|
| AI / ML / LLM / GenAI / agents / RAG / NLP / Data Science | **AI Engineer** | `Meet_Patel_AI_Engineer.pdf` |
| Backend / Python / FastAPI / SDE / platform / data infra | **Python Developer** | `Meet_Patel_Python_Developer.pdf` |
| Mentions both | Treat as AI | AI resume |

In **dynamic mode** the app decides for you: the AI classifies the role
(ai/backend), renders the matching template, and shows a 📎 hint telling you
exactly which resume to attach. Trust it.

In **static mode** the template auto-suggester matches the role title you typed
against each template's keywords — both defaults now carry a wide keyword list
("ml", "genai", "sde", "fullstack", …) so the right one surfaces on its own.

**Resume files in the app:** when you save a resume, give its role-type field
the same kind of keywords ("ai ml llm engineer" / "python backend fastapi") —
that's what the auto-suggester matches on. Never attach a file named `ai.pdf`;
recruiters see the filename.

---

## 3. Targeting rules (these matter more than the wording)

1. **Never send to `hr@`, `careers@`, or `info@`.** The app blocks these in AI
   mode for a reason — find a person on LinkedIn: recruiter, engineering lead, or CTO.
2. **At a startup (<100 people), email the engineering lead or CTO, not HR.**
   Highest response rate of any channel available to you.
3. **15–20 targeted sends per week beats 200 cold ones.** The 200-cold
   experiment returned zero. The app caps you at 20/day on purpose.
4. **Apply within 48 hours of a posting going live.** After a week the pile is
   too deep to matter.
5. **Send Tuesday–Thursday, 9:30–11:00 AM IST.** Monday and Friday get buried.
6. **One follow-up. Ever.** Day 6, from the Follow-ups page. Then stop.

---

## 4. Static template — AI Engineer

> **Subject:** AI Engineer — production LLM agent over 30+ tools

Hi {first_name},

{custom1}

I build LLM agents that run in production, not demos. At NETAI I own our
network-operations agent: a ReAct loop that plans over 30+ typed tools served
through MCP servers, streams results to the UI over SSE, and runs against
OpenAI, Anthropic, Gemini and a self-hosted Mistral behind one interface. I
also built the FAISS RAG pipeline and the FastAPI/Kafka/ClickHouse backend
underneath it.

A year of this, and I'd like to do it somewhere the agent is the product.

Are you hiring? Resume attached.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286

*`{first_name}` fills from the recipient's name (falls back politely when
unknown). `{custom1}` is your one personalised line about them — their product,
a post, the specific role.*

---

## 5. Static template — Python Developer

> **Subject:** Python/FastAPI engineer — Kafka→ClickHouse at sub-5s latency

Hi {first_name},

{custom1}

I'm a backend engineer at NETAI. Two systems I own:

- A real-time alerting pipeline — Alertmanager → Kafka → idempotent Python
  consumers → ClickHouse — sustaining thousands of alerts/day at sub-5-second
  end-to-end latency, with live WebSocket push to the ops UI.
- A centralised RADIUS (AAA) service, plus site-scoped RBAC for multi-tenant
  permissions across the platform.

I've also written a TR-069/CWMP auto-configuration server from scratch and an
Ed25519-signed offline licensing system.

Are you hiring for backend? Resume attached.

Meet Patel
+91 8799474373 · linkedin.com/in/meet-patel-34399b286

---

## 6. Follow-up (built into the app — Follow-ups page)

Don't write follow-ups by hand. The Follow-ups page lists everyone 6+ days old
with no reply. One click:

1. checks your Gmail first — if they replied, nothing is sent and the item resolves;
2. otherwise sends this, **as a reply inside your original email thread**:

> Hello, *(or "Hi Priya," when a real name is known — never "Hi Hr1")*
>
> I wanted to follow up on my earlier email regarding the [ROLE] position at
> [COMPANY], in case it got buried.
>
> A quick recap: over the past year at NETAI I have built production LLM
> systems — an MCP tool-calling agent, a Retrieval-Augmented Generation
> pipeline, and the FastAPI/Kafka/ClickHouse backend underneath them. I remain
> very interested in [COMPANY].
>
> If the timing isn't right, no problem at all — a short note either way would
> be much appreciated.
>
> Best regards,
> Meet Patel
> +91 8799474373 · linkedin.com/in/meet-patel-34399b286

One follow-up per person, ever — the app enforces it.

---

## 7. LinkedIn messages (manual — the app doesn't send these)

**Connection request (under 300 chars):**

> Hi [NAME] — Python engineer at NETAI, Ahmedabad. Built a production ReAct
> agent over 30+ tools served through MCP servers (LangChain, streaming,
> multi-provider). Keen on the LLM/agent work at [COMPANY]. Would like to connect.

**DM, 1 day after they accept:**

> Thanks for connecting, [NAME].
>
> Quick context in case it's useful: at NETAI I built a production LLM agent —
> a ReAct loop planning over 30+ typed tools served through MCP servers,
> streamed to the UI, with OpenAI/Anthropic/Gemini/self-hosted Mistral behind
> one interface. Also the RAG pipeline and the FastAPI + Kafka + ClickHouse
> backend under it.
>
> I'm looking for LLM/agent engineering roles. Is [COMPANY] hiring, or could
> you point me to whoever owns that team?

**Referral ask (highest-conversion message in this file — send to everyone you
actually know):**

> Hi [NAME], hope you're doing well.
>
> I'm looking to move into LLM/agent engineering, and I saw [COMPANY] has an
> opening for [ROLE]. Would you be comfortable referring me?
>
> For context: I'm at NETAI, and this past year I built a production ReAct
> agent over 30+ tools served through MCP servers, a FAISS RAG pipeline on a
> self-hosted model, and the FastAPI/Kafka/ClickHouse backend for both.
>
> Resume attached — completely fine if you'd rather not, no pressure at all.

---

## 8. Phrases that are never allowed (the AI is instructed to refuse them too)

| Cut | Why |
|---|---|
| "Application for [Role] Role" as a subject | Identical to 400 others; nothing to open |
| "Dear Hiring Team" | Signals mass-blast in three words |
| "I hope this message finds you well" | Filler; marks the email as a template |
| "I would welcome the chance to discuss…" | 16 words, no content, no ask |
| "Thank you for your time and consideration" | Filler |
| "passionate / dynamic / cutting-edge / excited to" | Adjectives instead of evidence |

---

## 9. One-time checklist

- [ ] GitHub bio: match your resume title (not "Python Backend Developer").
- [ ] Pin your 6 strongest repos — not `tic-tac-toe` / `Textutils`.
- [ ] Resume files named `Meet_Patel_AI_Engineer.pdf` / `Meet_Patel_Python_Developer.pdf`.
- [ ] In the app, tag each saved resume's role-type with rich keywords so
      auto-selection works.
