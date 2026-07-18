import { kvGet, kvKeys } from "@/lib/storage";
import { ok, requireUser } from "@/app/api/jobs/_helpers";

// Server-side send batches for the current user (synced across devices).
interface ServerBatch {
  id: string;
  userEmail: string;
  timestamp: string;
  subject: string;
  body: string;
  from: string;
  hasAttachment: boolean;
  attachmentName: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  results: { email: string; name: string; status: string; error?: string }[];
  deletedByUser?: boolean;
}

// GET — the current user's send history, newest first, in the same shape the
// client's SendBatch cache uses. This is what makes history the same on every
// device you log in from.
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const idKeys = await kvKeys(`userbatch:${auth.email.toLowerCase()}:*`);
  const ids = await Promise.all(idKeys.map((k) => kvGet<string>(k)));
  const batches = await Promise.all(
    ids.filter((id): id is string => !!id).map((id) => kvGet<ServerBatch>(`batch:${id}`)),
  );
  const valid = batches.filter((b): b is ServerBatch => !!b && !b.deletedByUser);
  valid.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const mapped = valid.map((b) => ({
    id: b.id,
    timestamp: b.timestamp,
    subject: b.subject,
    body: b.body,
    from: b.from,
    hasAttachment: b.hasAttachment,
    attachmentName: b.attachmentName,
    totalRecipients: b.totalRecipients,
    sent: b.sent,
    failed: b.failed,
    results: (b.results || []).map((r) => ({
      email: r.email,
      name: r.name,
      status: (r.status === "sent" ? "sent" : "failed") as "sent" | "failed",
      error: r.error,
    })),
    durationMs: 0,
  }));

  return ok({ batches: mapped });
}
