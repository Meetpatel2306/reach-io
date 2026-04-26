import { NextResponse } from "next/server";
import { isKvConfigured } from "@/lib/storage";

// Returns current configuration status — safe (no secret values exposed)
export async function GET() {
  // Find all KV/Redis-related env var KEYS (not values) for diagnostics
  const kvRelatedKeys = Object.keys(process.env).filter((k) =>
    k.startsWith("KV_") || k.startsWith("UPSTASH_") || k.startsWith("REDIS_") || k === "STORAGE_URL"
  );

  return NextResponse.json({
    sessionSecret: !!process.env.SESSION_SECRET,
    kv: isKvConfigured(),
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    isVercel: !!process.env.VERCEL,
    nodeEnv: process.env.NODE_ENV,
    persistence: isKvConfigured()
      ? "KV/Upstash (persistent across restarts)"
      : process.env.VERCEL
      ? "/tmp file (EPHEMERAL — data lost on cold starts)"
      : "Local JSON file (persistent in dev only)",
    // Diagnostics: which env var keys exist (NO VALUES)
    detectedEnvKeys: kvRelatedKeys,
    looksLikeUpstash: kvRelatedKeys.some((k) => k.startsWith("UPSTASH_")),
    looksLikeVercelKv: kvRelatedKeys.some((k) => k.startsWith("KV_")),
  });
}
