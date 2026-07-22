import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { appendHistory, listHistory, newId, nowIso, updateHistory, type SendRecord } from "@/lib/jobApp";
import { renderFollowUpBody } from "@/lib/candidate";
import { resolveTransport, sendOne } from "@/lib/mailer";
import { getGoogleForSend } from "@/lib/settings";
import { getGoogleAccessToken } from "@/lib/google";
import { hasReplyFor } from "@/lib/replies";

// POST /api/jobs/followups/send  — body: { id }
//
// One-click follow-up for a sent application:
//   1. Checks Gmail first — if the recipient already replied, no follow-up is
//      sent and the item is resolved ("they replied").
//   2. Otherwise sends the fixed follow-up copy as a REPLY in the original
//      thread: subject "Re: <original>", In-Reply-To/References headers, and
//      the Gmail thread id when we have one.
//   3. One follow-up ever per recipient — a second click is refused.

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing record id" }, { status: 400 });

    const history = await listHistory(auth.email);
    const rec = history.find((r) => r.id === id);
    if (!rec) return NextResponse.json({ error: "Send record not found" }, { status: 404 });
    if (rec.status !== "sent") return NextResponse.json({ error: "Original email was never sent" }, { status: 400 });
    if (rec.isFollowUp) return NextResponse.json({ error: "That record is itself a follow-up" }, { status: 400 });
    if (rec.followUpDone) return NextResponse.json({ error: "Already followed up (or resolved). One follow-up, ever." }, { status: 400 });

    const emailKey = rec.contactEmail.toLowerCase();
    const priorFollowUp = history.find(
      (r) => r.isFollowUp && r.status === "sent" && r.contactEmail.toLowerCase() === emailKey,
    );
    if (priorFollowUp) {
      await updateHistory(auth.email, rec.id, { followUpDone: true });
      return NextResponse.json({ error: "This person already got a follow-up. One follow-up, ever — then stop." }, { status: 400 });
    }

    // Auto-cancel: if they replied (checked against this record's own thread
    // only), don't nudge — move them to the responses list instead.
    const google = await getGoogleForSend(auth.email);
    if (google) {
      const token = await getGoogleAccessToken(google.refreshToken);
      if (token) {
        try {
          if (await hasReplyFor(token, rec)) {
            await updateHistory(auth.email, rec.id, { followUpDone: true, replied: true, repliedAt: nowIso() });
            return NextResponse.json({ replied: true, message: "They already replied — moved to your Responses list. No follow-up sent." });
          }
        } catch {
          // Reply check is best-effort; a Gmail hiccup shouldn't block the follow-up.
        }
      }
    }

    const transport = await resolveTransport(auth.email);
    if (transport.method === null) {
      return NextResponse.json({ error: transport.error }, { status: 400 });
    }

    const followUpBody = renderFollowUpBody({
      recipientName: rec.contactName,
      recipientEmail: rec.contactEmail,
      company: rec.company,
      role: rec.role,
    });
    const subject = rec.subject.startsWith("Re:") ? rec.subject : `Re: ${rec.subject}`;

    const info = await sendOne(transport, {
      to: rec.contactEmail,
      subject,
      body: followUpBody,
      threading: {
        inReplyTo: rec.messageId,
        references: rec.messageId,
        threadId: rec.threadId,
      },
    });

    await updateHistory(auth.email, rec.id, { followUpDone: true });
    const followUpRecord: SendRecord = {
      id: newId(),
      status: "sent",
      sentAt: nowIso(),
      contactId: rec.contactId,
      contactEmail: rec.contactEmail,
      contactName: rec.contactName,
      company: rec.company,
      role: rec.role,
      templateId: "",
      templateName: "Follow-up (threaded)",
      resumeId: null,
      resumeLabel: "",
      subject,
      body: followUpBody,
      isFollowUp: true,
      followUpDone: true,
      ...(info.messageId ? { messageId: info.messageId } : {}),
      ...(info.threadId ? { threadId: info.threadId } : {}),
    };
    await appendHistory(auth.email, followUpRecord);

    return NextResponse.json({
      sent: true,
      threaded: !!(rec.messageId || rec.threadId),
      subject,
      message: rec.messageId || rec.threadId
        ? "Follow-up sent inside the original email thread."
        : "Follow-up sent. (Original was sent before threading existed, so it went as a new email with the same subject.)",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
