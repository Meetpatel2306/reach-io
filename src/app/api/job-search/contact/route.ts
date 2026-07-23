import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/jobs/_helpers";
import { findContact } from "@/lib/jobSearch";
import { listLeads, updateLead } from "@/lib/jobLeads";

export const maxDuration = 60;

// POST /api/job-search/contact  { id } — targeted AI search for one company's
// careers page + public contact email/phone. Only fills fields that are still
// empty (never overwrites something the user typed manually).
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "");
    const lead = (await listLeads(auth.email)).find((l) => l.id === id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const found = await findContact(lead.company, lead.role);
    const patch: Record<string, string> = {};
    if (!lead.careerPage && found.careerPage) patch.careerPage = found.careerPage;
    if (!lead.contactEmail && found.contactEmail) patch.contactEmail = found.contactEmail;
    if (!lead.contactPhone && found.contactPhone) patch.contactPhone = found.contactPhone;

    const updated = Object.keys(patch).length ? await updateLead(auth.email, id, patch) : lead;
    const foundAnything = Object.keys(patch).length > 0;
    return NextResponse.json({
      lead: updated,
      foundAnything,
      provider: found.provider,
      message: foundAnything
        ? "Contact details found and filled."
        : "Nothing public found — fill the fields manually (LinkedIn is usually the way).",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Contact search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
