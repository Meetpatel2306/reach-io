// Server-only AI personalisation layer.
// Primary: Gemini (gemini-2.5-flash). Secondary: Groq (llama-3.3-70b-versatile).
// The model does NOT write the email — it writes the subject line + the hook and
// picks which real project to lead with. The app renders the fixed body around
// that output (see candidate.ts), which keeps every claim true.

import { CANDIDATE_FACTS } from "./candidate";

export interface AiPersonalization {
  subject: string;
  hook: string;
  lead_project_id: string;
  second_project_id?: string;
  confidence: "high" | "low";
  reason: string;
  provider: "gemini" | "groq";
}

export interface AiInput {
  company: string;
  recipientName: string;
  recipientTitle: string;
  roleTitle: string;
  jdText: string;
}

const SYSTEM_INSTRUCTION = `You write the personalised parts of cold job-application emails for one specific
candidate. You do NOT write the whole email — the app renders a fixed body around
your output.

## Your only job

Read the job description and produce:
  1. a subject line
  2. a hook — one or two sentences that prove this email was written for THIS company
  3. which of the candidate's real projects to lead with
  4. a confidence flag

## Absolute rules

1. NEVER invent a fact about the candidate. You may only use the CANDIDATE_FACTS
   provided. You may rephrase them; you may not add to them. Do not state years of
   experience, technologies, employers, metrics, education or achievements that are
   not in CANDIDATE_FACTS. If a job description asks for something the candidate does
   not have, say nothing about it — never imply it.
2. NEVER invent a fact about the company. The hook must be traceable to the job
   description text you were given. If the job description is boilerplate with nothing
   company-specific in it, set confidence to "low" and return an empty hook. An empty
   hook is a correct answer. A generic hook is a failure.
3. Pick lead_project_id by matching the job description's actual requirements against
   the "tags" on each project. Choose the single best match.

## Voice

Direct, technical, peer-to-peer. The reader is an engineer or a technical recruiter.
Short sentences. Concrete nouns. No adjectives about the candidate.

## Banned — never output these or anything like them

- "I hope this message finds you well"
- "I am writing to express my interest"
- "I would welcome the chance to discuss"
- "Thank you for your time and consideration"
- "passionate", "dynamic", "cutting-edge", "leverage", "synergy", "excited to",
  "thrilled", "delve", "landscape", "robust", "seamless"
- "Application for [Role] Role" as a subject line
- Any praise of the company that could be pasted into a different company's email
  ("impressive work", "innovative team", "industry leader")

## Subject line rules

- 45-60 characters
- Must contain one concrete, specific noun from the candidate's work
  (e.g. "MCP agent", "Kafka→ClickHouse", "RAG pipeline")
- No "Application for". No exclamation marks. Do not start with "Re:".
- Written to be opened on a phone lock screen

## Hook rules

- 1-2 sentences, maximum 40 words
- Sentence one: something specific about THIS company, from the job description —
  the product, the stack, a named system, the actual problem the role solves
- Sentence two (optional): the single line connecting that to the candidate's work
- Never open with "I". Never open with the company name alone.
- If you would have to be vague, return "" and set confidence to "low"

## Output

Return only JSON matching the provided schema. No markdown, no commentary.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    hook: { type: "string" },
    lead_project_id: { type: "string" },
    second_project_id: { type: "string" },
    confidence: { type: "string", enum: ["high", "low"] },
    reason: {
      type: "string",
      description: "one line: why this hook and this project. for your review screen only, never sent.",
    },
  },
  required: ["subject", "hook", "lead_project_id", "confidence", "reason"],
};

function buildUserMessage(input: AiInput): string {
  return `COMPANY: ${input.company}
RECIPIENT: ${input.recipientName || "Unknown"} — ${input.recipientTitle || "Unknown"}
ROLE: ${input.roleTitle}

JOB_DESCRIPTION:
"""
${input.jdText}
"""

CANDIDATE_FACTS:
${JSON.stringify(CANDIDATE_FACTS, null, 2)}`;
}

interface ParsedOutput {
  subject: string;
  hook: string;
  lead_project_id: string;
  second_project_id?: string;
  confidence: "high" | "low";
  reason: string;
}

function parseModelJson(text: string): ParsedOutput {
  // Strip a ```json fence if a model added one despite instructions.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const obj = JSON.parse(cleaned);
  if (typeof obj.subject !== "string" || typeof obj.hook !== "string" || typeof obj.lead_project_id !== "string") {
    throw new Error("Model output missing required fields");
  }
  return {
    subject: obj.subject.trim(),
    hook: obj.hook.trim(),
    lead_project_id: obj.lead_project_id,
    second_project_id: typeof obj.second_project_id === "string" ? obj.second_project_id : undefined,
    confidence: obj.confidence === "low" ? "low" : "high",
    reason: typeof obj.reason === "string" ? obj.reason : "",
  };
}

async function callGemini(input: AiInput, apiKey: string): Promise<ParsedOutput> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: buildUserMessage(input) }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return parseModelJson(text);
}

async function callGroq(input: AiInput, apiKey: string): Promise<ParsedOutput> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            SYSTEM_INSTRUCTION +
            `\n\nReturn a single JSON object with exactly these keys: "subject" (string), "hook" (string), "lead_project_id" (string), "second_project_id" (string, optional), "confidence" ("high" or "low"), "reason" (string).`,
        },
        { role: "user", content: buildUserMessage(input) },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");
  return parseModelJson(text);
}

// Gemini first; if it errors (bad key, quota, outage), fall back to Groq.
export async function generatePersonalization(input: AiInput): Promise<AiPersonalization> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    throw new Error("No AI key configured. Add GEMINI_API_KEY (and optionally GROQ_API_KEY as backup) to the environment.");
  }

  let geminiError = "";
  if (geminiKey) {
    try {
      const out = await callGemini(input, geminiKey);
      return { ...out, provider: "gemini" };
    } catch (err: unknown) {
      geminiError = err instanceof Error ? err.message : String(err);
    }
  }

  if (groqKey) {
    try {
      const out = await callGroq(input, groqKey);
      return { ...out, provider: "groq" };
    } catch (err: unknown) {
      const groqError = err instanceof Error ? err.message : String(err);
      throw new Error(
        geminiError
          ? `Both AI providers failed. Gemini: ${geminiError} · Groq: ${groqError}`
          : `Groq failed: ${groqError}`,
      );
    }
  }

  throw new Error(`Gemini failed and no Groq backup key is set. Gemini: ${geminiError}`);
}
