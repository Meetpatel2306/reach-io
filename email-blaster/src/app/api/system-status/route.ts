import { NextResponse } from "next/server";
import { isKvConfigured } from "@/lib/storage";

// Returns current configuration status — safe (no secret values exposed)
export async function GET() {
  return NextResponse.json({
    sessionSecret: !!process.env.SESSION_SECRET,
    kv: isKvConfigured(),
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    isVercel: !!process.env.VERCEL,
    nodeEnv: process.env.NODE_ENV,
    persistence: isKvConfigured()
      ? "Vercel KV (persistent across restarts)"
      : process.env.VERCEL
      ? "/tmp file (EPHEMERAL — data lost on cold starts)"
      : "Local JSON file (persistent in dev only)",
  });
}
