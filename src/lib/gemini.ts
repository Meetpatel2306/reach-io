// Server-only Gemini transport with automatic model resolution AND key rotation.
//
// Models: Google retires model IDs (gemini-2.5-flash 404s for newer accounts),
// so we try candidates in order and remember the first that works. GEMINI_MODEL
// env var overrides the candidate list when set.
//
// Keys: callers pass the user's stored keys (possibly several). When a key is
// out of quota (429) or invalid (401/403), the next key takes over.

const CANDIDATES = [
  process.env.GEMINI_MODEL, // explicit override always wins
  "gemini-flash-latest", // rolling alias — always the newest flash
  "gemini-3-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash", // still valid for older accounts
].filter((m): m is string => typeof m === "string" && m.length > 0);

let workingModel: string | null = null;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export function geminiTextFrom(data: GeminiResponse): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("");
}

export async function geminiGenerate(
  apiKeys: string | string[],
  payload: Record<string, unknown>,
): Promise<{ data: GeminiResponse; model: string }> {
  const keys = (Array.isArray(apiKeys) ? apiKeys : [apiKeys]).filter(Boolean);
  if (!keys.length) {
    throw new Error("No Gemini API key configured — add yours in the AI keys section on the Jobs page.");
  }

  const models = workingModel
    ? [workingModel, ...CANDIDATES.filter((m) => m !== workingModel)]
    : CANDIDATES;
  let lastErr = "";

  for (const key of keys) {
    for (const model of models) {
      // Gemini 3 models reject the 2.5-era thinkingConfig — send it only to 2.5.
      const body = { ...payload } as { generationConfig?: Record<string, unknown> };
      if (!model.startsWith("gemini-2.5") && body.generationConfig && "thinkingConfig" in body.generationConfig) {
        const { thinkingConfig: _drop, ...rest } = body.generationConfig;
        body.generationConfig = rest;
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        workingModel = model;
        return { data: await res.json(), model };
      }

      const errText = await res.text();
      lastErr = `${model} → ${res.status} ${errText.slice(0, 160)}`;

      // Key-level failures: quota exhausted or bad key → rotate to the next key.
      if (res.status === 429 || res.status === 401 || res.status === 403) break;
      // Model-level failures: retired/unknown model or unsupported field → next model.
      const nextModel = res.status === 404 || (res.status === 400 && /model|thinking|not supported/i.test(errText));
      if (!nextModel) throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
    }
  }

  throw new Error(
    `All Gemini keys/models failed (last: ${lastErr}). If this is quota, add another key in the AI keys section — the app rotates automatically.`,
  );
}
