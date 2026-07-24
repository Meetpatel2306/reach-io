import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { addAiKey, getAiKeysView, removeAiKey, type AiProvider } from "@/lib/settings";

// Per-user AI provider keys. Stored encrypted with the user's account data, so
// the same keys follow the user to any device. Multiple keys per provider are
// allowed — the AI clients rotate to the next key when one hits its quota.

function parseProvider(v: unknown): AiProvider | null {
  return v === "gemini" || v === "groq" ? v : null;
}

// GET ?reveal=1 — list keys (masked by default; revealed for the owner on request).
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const reveal = new URL(req.url).searchParams.get("reveal") === "1";
  const keys = await getAiKeysView(auth.email, reveal);
  return NextResponse.json({ keys, revealed: reveal });
}

// POST { provider, key } — add a key to the user's account.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const provider = parseProvider(body.provider);
  const key = String(body.key || "").trim();
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  if (key.length < 20) return NextResponse.json({ error: "That doesn't look like a valid API key." }, { status: 400 });
  if (provider === "gemini" && !key.startsWith("AIza")) {
    return NextResponse.json({ error: "Gemini keys start with \"AIza...\" — check you pasted the right one." }, { status: 400 });
  }
  if (provider === "groq" && !key.startsWith("gsk_")) {
    return NextResponse.json({ error: "Groq keys start with \"gsk_...\" — check you pasted the right one." }, { status: 400 });
  }
  await addAiKey(auth.email, provider, key);
  return NextResponse.json({ keys: await getAiKeysView(auth.email) });
}

// DELETE { provider, index } — remove one key.
export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const provider = parseProvider(body.provider);
  const index = Number(body.index);
  if (!provider || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await removeAiKey(auth.email, provider, index);
  return NextResponse.json({ keys: await getAiKeysView(auth.email) });
}
