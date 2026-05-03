import { followUpsDue, listHistory } from "@/lib/jobApp";
import { ok, requireUser } from "../_helpers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const threshold = parseInt(url.searchParams.get("days") || "7", 10);
  const history = await listHistory(auth.email);
  return ok({ followUps: followUpsDue(history, isNaN(threshold) ? 7 : threshold) });
}
