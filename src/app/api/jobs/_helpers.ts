// Shared helpers for /api/jobs/* routes — auth + JSON parsing.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export interface AuthOk { ok: true; email: string; }
export interface AuthFail { ok: false; response: NextResponse; }
export type AuthResult = AuthOk | AuthFail;

export async function requireUser(): Promise<AuthResult> {
  const session = await getSession();
  if (!session.email) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, email: session.email };
}

export function ok(data: unknown): NextResponse {
  return NextResponse.json(data);
}

export function bad(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
