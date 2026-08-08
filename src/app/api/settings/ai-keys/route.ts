import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { addAiKey, getAiKeysView, removeAiKey, type AiProvider } from "@/lib/settings";

// Per-user AI provider keys. Stored encrypted with the user's account data, so
// the same keys follow the user to any device. Multiple keys per provider are
// allowed — the AI clients rotate to the next key when one hits its quota.

function parseProvider(v: unknown): AiProvider | null {
  return v === "gemini" || v === "groq" ? v : null;
}

// Verify the key by USING it, rather than pattern-matching its shape.
//
// This used to require "AIza"/"gsk_" prefixes, which rejected perfectly good
// freshly-issued keys the moment a provider changed its format — the same trap
// as hardcoding model IDs (see the note atop lib/gemini.ts). A live call is
// both future-proof and a stronger check: it catches typos, revoked keys and
// keys pasted into the wrong provider, none of which a prefix test can see.
//
// Returns null when the key works, or a human-readable reason when it does not.
// A network failure returns null too: we will not block someone from saving a
// valid key because the provider happened to be unreachable.
async function verifyKey(provider: AiProvider, key: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res =
      provider === "gemini"
        ? await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
            { signal: ctrl.signal },
          )
        : await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
            signal: ctrl.signal,
          });

    if (res.ok) return null;
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return provider === "gemini"
        ? "Google rejected that key. Check you copied all of it from aistudio.google.com/apikey, and that the Generative Language API is enabled for its project."
        : "Groq rejected that key. Copy it again from console.groq.com/keys — a Groq key is only shown once, at creation.";
    }
    if (res.status === 429) return null; // rate-limited, but the key is real
    return null; // provider trouble, not the user's problem — let it save
  } catch {
    return null; // timeout or network error — do not block the save
  } finally {
    clearTimeout(timer);
  }
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
  if (key.length < 20) {
    return NextResponse.json(
      { error: "That looks too short to be an API key — check the whole value was copied." },
      { status: 400 },
    );
  }
  if (/\s/.test(key)) {
    return NextResponse.json(
      { error: "That key contains a space or line break — copy it again without the surrounding text." },
      { status: 400 },
    );
  }

  const problem = await verifyKey(provider, key);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

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
