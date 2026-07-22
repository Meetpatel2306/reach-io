import { FOLLOW_UP_DAY, followUpsDue, listHistory, respondedList } from "@/lib/jobApp";
import { ok, requireUser } from "../_helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const threshold = parseInt(url.searchParams.get("days") || String(FOLLOW_UP_DAY), 10);
  const history = await listHistory(auth.email);
  return ok({
    followUps: followUpsDue(history, isNaN(threshold) ? FOLLOW_UP_DAY : threshold),
    responded: respondedList(history),
  });
}
