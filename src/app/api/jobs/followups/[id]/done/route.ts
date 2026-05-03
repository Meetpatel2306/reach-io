import { NextRequest } from "next/server";
import { updateHistory } from "@/lib/jobApp";
import { ok, requireUser } from "../../../_helpers";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await updateHistory(auth.email, id, { followUpDone: true });
  return ok({ success: true });
}
