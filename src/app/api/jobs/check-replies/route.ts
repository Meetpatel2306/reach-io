import { NextRequest, NextResponse } from "next/server";
import { followUpsDue, listHistory, updateHistory } from "@/lib/jobApp";
import { getGoogleForSend } from "@/lib/settings";
import { getGoogleAccessToken } from "@/lib/google";
import { requireUser } from "../_helpers";

// POST /api/jobs/check-replies
// Body: { daysThreshold?: number }. Uses the user's stored (server-side) Google
// connection to query Gmail — no client token needed, works across devices.
// For each pending follow-up (sent >= threshold days ago, not yet marked replied/done),
// queries the user's Gmail for an inbound message from that recipient AFTER the send time.
// If found, marks `followUpDone: true` and `replied: true` in the history record.
// Returns the updated list of follow-ups (the still-pending ones).

interface GmailMessageRef { id: string; threadId: string; }
interface GmailListResp { messages?: GmailMessageRef[]; resultSizeEstimate?: number; }

async function gmailHasReply(
  token: string,
  fromEmail: string,
  afterUnixSec: number,
): Promise<boolean> {
  // Use `in:anywhere` so replies in inbox / spam / all-mail all count.
  const q = `from:${fromEmail} after:${afterUnixSec}`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gmail list ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data: GmailListResp = await res.json();
  return Array.isArray(data.messages) && data.messages.length > 0;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const threshold: number = typeof body.daysThreshold === "number" ? body.daysThreshold : 7;

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
  // Walk every "sent" entry that hasn't been resolved; check Gmail once per unique recipient.
  const seenEmails = new Set<string>();
  const updates: { id: string; email: string; replied: boolean; sentAt: string }[] = [];
  let checked = 0;
  let errors: string[] = [];

  for (const rec of history) {
    if (rec.status !== "sent") continue;
    if (rec.followUpDone) continue;
    if (rec.isFollowUp) continue;
    const emailKey = rec.contactEmail.toLowerCase();
    if (seenEmails.has(emailKey)) continue;
    seenEmails.add(emailKey);

    const sentAtMs = new Date(rec.sentAt).getTime();
    const afterUnix = Math.floor(sentAtMs / 1000);
    try {
      checked++;
      const replied = await gmailHasReply(token, emailKey, afterUnix);
      updates.push({ id: rec.id, email: emailKey, replied, sentAt: rec.sentAt });
      if (replied) {
        await updateHistory(auth.email, rec.id, { followUpDone: true });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${emailKey}: ${msg}`);
      // 401 = bad token; stop scanning, give the client a clear hint.
      if (msg.includes("401") || msg.toLowerCase().includes("invalid_grant")) {
        return NextResponse.json(
          { error: "Google token expired or missing gmail.readonly scope. Sign out and sign in with Google again." },
          { status: 401 },
        );
      }
    }
  }

  // Refresh the follow-ups list with the new state.
  const refreshed = await listHistory(auth.email);
  const stillPending = followUpsDue(refreshed, threshold);
  const repliedCount = updates.filter((u) => u.replied).length;

  return NextResponse.json({
    checked,
    repliedCount,
    pendingCount: stillPending.length,
    pending: stillPending,
    errors: errors.length ? errors : undefined,
  });
}
