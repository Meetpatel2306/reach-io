import { NextRequest, NextResponse } from "next/server";
import { FOLLOW_UP_DAY, followUpsDue, listHistory, nowIso, respondedList, updateHistory } from "@/lib/jobApp";
import { getGoogleForSend } from "@/lib/settings";
import { getGoogleAccessToken } from "@/lib/google";
import { hasReplyFor } from "@/lib/replies";
import { requireUser } from "../_helpers";

// POST /api/jobs/check-replies
// Uses the user's stored (server-side) Google connection to check ONLY the
// conversations this app sent — each record's own Gmail thread (or, for old
// records without a thread id, a search limited to that recipient after the
// send time). Recipients who replied get `replied: true` and move to the
// responses list; everyone else stays eligible for follow-up.

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const threshold: number = typeof body.daysThreshold === "number" ? body.daysThreshold : FOLLOW_UP_DAY;

  const google = await getGoogleForSend(auth.email);
  if (!google) {
    return NextResponse.json(
      { error: "Connect Google to enable reply detection (Gmail read access is required)." },
      { status: 400 },
    );
  }
  const token = await getGoogleAccessToken(google.refreshToken);
  if (!token) {
    return NextResponse.json(
      { error: "Your Google connection has expired. Reconnect Google in Settings." },
      { status: 401 },
    );
  }

  const history = await listHistory(auth.email);
  // Check each unresolved outreach email once per unique recipient.
  const seenEmails = new Set<string>();
  let checked = 0;
  let repliedCount = 0;
  const errors: string[] = [];

  for (const rec of history) {
    if (rec.status !== "sent") continue;
    if (rec.isFollowUp) continue;
    if (rec.replied) continue;
    const emailKey = rec.contactEmail.toLowerCase();
    if (seenEmails.has(emailKey)) continue;
    seenEmails.add(emailKey);

    try {
      checked++;
      const replied = await hasReplyFor(token, rec);
      if (replied) {
        repliedCount++;
        await updateHistory(auth.email, rec.id, { replied: true, repliedAt: nowIso(), followUpDone: true });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${emailKey}: ${msg}`);
      if (msg.includes("401") || msg.toLowerCase().includes("invalid_grant")) {
        return NextResponse.json(
          { error: "Google token expired or missing gmail.readonly scope. Sign out and sign in with Google again." },
          { status: 401 },
        );
      }
    }
  }

  const refreshed = await listHistory(auth.email);
  const stillPending = followUpsDue(refreshed, threshold);
  const responded = respondedList(refreshed);

  return NextResponse.json({
    checked,
    repliedCount,
    pendingCount: stillPending.length,
    pending: stillPending,
    responded,
    errors: errors.length ? errors : undefined,
  });
}
