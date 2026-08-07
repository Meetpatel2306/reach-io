import { NextRequest, NextResponse } from "next/server";
import { ADMIN_EMAIL, getSession } from "@/lib/auth";
import { getDailyDigest, istNow, saveDailyDigest } from "@/lib/settings";

// Schedule for the daily Ahmedabad digest. Admin-only: the cron runs against
// the owner's account and mails the owner, so nobody else has a schedule to set.

async function requireAdmin(): Promise<string | null> {
  const session = await getSession();
  const email = session.email?.toLowerCase();
  if (!email) return null;
  const isAdmin = session.role === "admin" || email === ADMIN_EMAIL.toLowerCase();
  return isAdmin ? ADMIN_EMAIL : null;
}

export async function GET() {
  const email = await requireAdmin();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const digest = await getDailyDigest(email);
  // istNow lets the UI say "next run in N hours" without guessing the server's tz.
  return NextResponse.json({ digest, now: istNow() });
}

export async function PUT(req: NextRequest) {
  const email = await requireAdmin();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: { enabled?: boolean; hourIst?: number; minuteIst?: number } = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.hourIst !== undefined) {
    const h = Number(body.hourIst);
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      return NextResponse.json({ error: "Hour must be 0-23 (IST)." }, { status: 400 });
    }
    patch.hourIst = h;
  }
  if (body.minuteIst !== undefined) {
    const m = Number(body.minuteIst);
    if (m !== 0 && m !== 30) {
      return NextResponse.json({ error: "Minutes must be 0 or 30 — the scheduler ticks every half hour." }, { status: 400 });
    }
    patch.minuteIst = m;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const digest = await saveDailyDigest(email, patch);
  return NextResponse.json({ digest, now: istNow() });
}
