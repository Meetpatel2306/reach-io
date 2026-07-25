# Reach.io — AI Job-Outreach Platform

A full-stack product for running a serious job search: find real openings, send AI-personalised application emails, and never miss a follow-up — all from one app.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-4285F4?style=flat&logo=googlegemini&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)

---

## What it does

### ✉️ AI-personalised outreach
- **Dynamic drafts**: Gemini reads the job description and writes only the subject line and a company-specific opening hook — the app renders the rest from a fixed, always-true body, so the AI can never invent facts about the candidate
- **Automatic fallback**: Groq takes over when Gemini is unavailable, with multi-key rotation when a key runs out of quota
- **Guard rails**: duplicate-contact detection, per-company cooldown, daily send cap, and a mandatory review-before-send screen

### 🔎 Job Finder
- **Google-grounded search**: the AI runs real web searches (no stale aggregator feeds) and returns only postings with a direct apply link
- **Saved leads table**: every search appends to a persistent, fully editable pipeline — company, role, experience, package, contacts, status (New → Applied → Interview), notes
- **One-click apply**: picks the AI or Python resume automatically from the role's keywords, renders the matching email template, sends, and logs it — one click

### 🔔 Follow-ups that thread
- Sends the follow-up **inside the original Gmail thread** (`In-Reply-To` / `References` / thread id)
- Checks Gmail for a reply first and auto-resolves — never nudges someone who already answered
- One follow-up per person, ever; replies land in a separate Responses list

### 🔐 Infrastructure
- Google OAuth (Gmail API) sending with SMTP app-password fallback
- Per-user AI keys and credentials **encrypted at rest (AES-256-GCM)**, synced across devices via Redis/KV
- Installable PWA with auto-update; deployed on Vercel

## Stack

Next.js (App Router) · TypeScript · Tailwind · Vercel KV (Upstash Redis) · Gemini + Groq APIs · Gmail API / Nodemailer · iron-session · Vitest + Playwright

## Architecture notes

- `src/lib/mailer.ts` — shared transport (Gmail API raw RFC-822 with threading headers, SMTP fallback)
- `src/lib/ai.ts` + `src/lib/gemini.ts` — draft generation with model auto-resolution and key rotation
- `src/lib/jobSearch.ts` — grounded search with prose-salvage JSON recovery
- `src/lib/candidate.ts` — the fixed fact sheet and email bodies the AI composes around

---

Built by [Meet Patel](https://github.com/Meetpatel2306) — AI Engineer (LLM agents, RAG & Python backend).
