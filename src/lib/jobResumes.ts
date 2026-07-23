// Server-only durable resume store for the Job Finder's one-click apply.
// Bytes live as base64 in KV (like Quick Slots), so they survive serverless
// restarts and work across devices — unlike the disk-based managed resumes.

import { kvGet, kvSet } from "./storage";

export interface JobResume {
  id: string;
  name: string; // display label, e.g. "AI Engineer resume"
  filename: string; // original file name sent as the attachment name
  base64: string; // raw base64 (no data: prefix)
  sizeBytes: number;
  createdAt: string;
}

const kResumes = (email: string) => `jobfinder:${email.toLowerCase()}:resumes`;

export const MAX_RESUME_BYTES = 1.5 * 1024 * 1024; // KV request-size safety

export async function listJobResumes(email: string): Promise<JobResume[]> {
  const v = await kvGet<JobResume[]>(kResumes(email));
  return Array.isArray(v) ? v : [];
}

export async function addJobResume(
  email: string,
  r: { name: string; filename: string; base64: string; sizeBytes: number },
): Promise<JobResume> {
  const all = await listJobResumes(email);
  const resume: JobResume = {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    name: r.name,
    filename: r.filename,
    base64: r.base64,
    sizeBytes: r.sizeBytes,
    createdAt: new Date().toISOString(),
  };
  // Same filename re-uploaded → replace instead of duplicating.
  await kvSet(kResumes(email), [resume, ...all.filter((x) => x.filename !== r.filename)]);
  return resume;
}

export async function deleteJobResume(email: string, id: string): Promise<void> {
  const all = await listJobResumes(email);
  await kvSet(kResumes(email), all.filter((r) => r.id !== id));
}
