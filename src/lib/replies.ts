// Server-only Gmail reply detection, scoped as narrowly as possible.
//
// Privacy contract: we only ever look at the SPECIFIC conversations this app
// sent. When we have the Gmail thread id of the sent email we read just that
// one thread's sender headers. Only when an old record predates thread
// tracking do we fall back to a search restricted to "from:<that recipient>
// after:<the send time>" — still never the rest of the inbox.

import type { SendRecord } from "./jobAppShared";

interface GmailHeader { name: string; value: string; }
interface GmailThreadMessage { payload?: { headers?: GmailHeader[] }; }

async function threadHasReply(token: string, threadId: string, recipientEmail: string): Promise<boolean> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Gmail thread ${res.status}`);
  const data = await res.json();
  const messages: GmailThreadMessage[] = Array.isArray(data.messages) ? data.messages : [];
  const target = recipientEmail.toLowerCase();
  return messages.some((m) => {
    const from = m.payload?.headers?.find((h) => h.name.toLowerCase() === "from")?.value || "";
    return from.toLowerCase().includes(target);
  });
}

async function searchHasReply(token: string, recipientEmail: string, afterUnixSec: number): Promise<boolean> {
  const q = `from:${recipientEmail} after:${afterUnixSec}`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Gmail list ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.messages) && data.messages.length > 0;
}

// Did the recipient of this send record reply to it?
export async function hasReplyFor(token: string, rec: SendRecord): Promise<boolean> {
  const email = rec.contactEmail.toLowerCase();
  if (rec.threadId) {
    try {
      return await threadHasReply(token, rec.threadId, email);
    } catch {
      // Thread may have been deleted — fall through to the scoped search.
    }
  }
  const afterUnix = Math.floor(new Date(rec.sentAt).getTime() / 1000);
  return searchHasReply(token, email, afterUnix);
}
