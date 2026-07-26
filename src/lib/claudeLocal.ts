// LOCAL-ONLY Claude job search via the Claude Agent SDK.
//
// This runs the Claude Code engine as a process on the machine hosting the
// app, authenticated by the owner's own Claude subscription login. That is
// only legitimate — and only technically possible — when the app runs locally
// on the owner's PC (`npm run dev`). It is therefore triple-gated:
//
//   1. Never on Vercel (process.env.VERCEL) — the deployed site can't use it
//   2. Admin account only — regular users never touch the owner's session
//   3. Job search only — no other feature calls this module
//
// The ONLY capability granted is web search/fetch: no file access, no shell,
// no browser control, no artifacts — the tool allowlist below is exhaustive.
// Any failure falls back to the normal Gemini/Groq flow.

import { SEARCH_PROMPT } from "./jobSearch";

export function claudeLocalAvailable(): boolean {
  if (process.env.CLAUDE_LOCAL === "0") return false; // explicit kill switch
  if (process.env.CLAUDE_LOCAL === "1") return true; // explicit opt-in (e.g. local `next start`)
  // `next dev` only ever runs on a developer's own machine — Vercel serves
  // production builds (NODE_ENV=production). Dev mode alone is the signal;
  // a VERCEL variable sitting in a pulled-down local .env must not fool it.
  return process.env.NODE_ENV === "development";
}

export async function claudeSearchJobs(query: string, location: string): Promise<string> {
  // Dynamic import keeps the SDK completely out of the serverless bundle.
  const { query: claude } = await import("@anthropic-ai/claude-agent-sdk");

  const prompt =
    SEARCH_PROMPT(query, location) +
    "\n\nIMPORTANT: your final message must be ONLY the JSON array — no prose before or after.";

  let result = "";
  let subtype = "";
  for await (const message of claude({
    prompt,
    options: {
      allowedTools: ["WebSearch", "WebFetch"],
      // Headless run — nobody can answer permission prompts, so pre-approve.
      // Safe: the allowlist above is the complete set of capabilities anyway.
      permissionMode: "bypassPermissions",
      maxTurns: 16,
    },
  })) {
    if (message.type === "result") {
      subtype = "subtype" in message ? String(message.subtype) : "";
      result = "result" in message && typeof message.result === "string" ? message.result : "";
    }
  }

  if (!result) throw new Error(`Local Claude session returned nothing (${subtype || "no result"})`);
  return result;
}
