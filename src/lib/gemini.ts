// Server-only Gemini transport with automatic model resolution.
//
// Google retires model IDs (gemini-2.5-flash 404s for newer accounts), so we
// never hardcode one call site again: try candidates in order, remember the
// first that works for the rest of the process lifetime. `GEMINI_MODEL` env var
// overrides everything when set.

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
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ data: GeminiResponse; model: string }> {
  const models = workingModel
    ? [workingModel, ...CANDIDATES.filter((m) => m !== workingModel)]
    : CANDIDATES;
  let lastErr = "";

  for (const model of models) {
    // Gemini 3 models reject the 2.5-era thinkingConfig — send it only to 2.5.
    const body = { ...payload } as { generationConfig?: Record<string, unknown> };
    if (!model.startsWith("gemini-2.5") && body.generationConfig && "thinkingConfig" in body.generationConfig) {
      const { thinkingConfig: _drop, ...rest } = body.generationConfig;
      body.generationConfig = rest;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
    // 404 = model retired/unknown for this key; 400 mentioning the model or
    // unsupported fields = wrong generation — try the next candidate. Anything
    // else (401 bad key, 429 quota, 5xx) is a real error the caller should see.
    const tryNext = res.status === 404 || (res.status === 400 && /model|thinking|not supported/i.test(errText));
    if (!tryNext) throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }

  throw new Error(
    `No available Gemini model for this API key (last: ${lastErr}). Set a GEMINI_MODEL env var to a model your key supports.`,
  );
}
