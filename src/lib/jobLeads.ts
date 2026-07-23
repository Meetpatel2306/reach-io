// Server-only storage for Job Finder leads. Own KV key — fully independent of
// the outreach/mail data (`job:<email>:history` etc. are untouched).

import { kvGet, kvSet } from "./storage";
import type { FoundJob } from "./jobSearch";

export type LeadStatus = "new" | "applied" | "interview" | "rejected";

export interface JobLead extends FoundJob {
  id: string;
  status: LeadStatus;
  notes: string;
  query: string;
  createdAt: string;
  updatedAt: string;
}

const kLeads = (email: string) => `jobfinder:${email.toLowerCase()}:leads`;

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function listLeads(email: string): Promise<JobLead[]> {
  const v = await kvGet<JobLead[]>(kLeads(email));
  return Array.isArray(v) ? v : [];
}

// Append found jobs, skipping ones already saved (same company + role).
export async function appendLeads(email: string, jobs: FoundJob[], query: string): Promise<{ added: JobLead[]; skipped: number }> {
  const all = await listLeads(email);
  const seen = new Set(all.map((l) => `${l.company.toLowerCase()}|${l.role.toLowerCase()}`));
  const now = new Date().toISOString();
  const added: JobLead[] = [];
  let skipped = 0;
  for (const j of jobs) {
    const key = `${j.company.toLowerCase()}|${j.role.toLowerCase()}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    added.push({ ...j, id: newId(), status: "new", notes: "", query, createdAt: now, updatedAt: now });
  }
  if (added.length) await kvSet(kLeads(email), [...added, ...all]);
  return { added, skipped };
}

export async function updateLead(email: string, id: string, patch: Partial<JobLead>): Promise<JobLead | null> {
  const all = await listLeads(email);
  let updated: JobLead | null = null;
  const next = all.map((l) => {
    if (l.id !== id) return l;
    // id/createdAt are immutable; everything else is user-editable.
    const { id: _id, createdAt: _c, ...rest } = patch;
    updated = { ...l, ...rest, updatedAt: new Date().toISOString() };
    return updated;
  });
  if (updated) await kvSet(kLeads(email), next);
  return updated;
}

export async function deleteLead(email: string, id: string): Promise<void> {
  const all = await listLeads(email);
  await kvSet(kLeads(email), all.filter((l) => l.id !== id));
}

export async function clearLeads(email: string): Promise<void> {
  await kvSet(kLeads(email), []);
}
