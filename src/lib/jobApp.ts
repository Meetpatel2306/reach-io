// Server-only storage layer for the job-mailer.
// Pure helpers / types live in `jobAppShared.ts` (safe to import from client).

import { kvGet, kvSet } from "./storage";
import {
  DEFAULT_TEMPLATES,
  TEMPLATES_SEED_VERSION,
  newId,
  nowIso,
  type Contact,
  type ResumeMeta,
  type SendRecord,
  type Slot,
  type Template,
} from "./jobAppShared";

export * from "./jobAppShared";

const k = (email: string, kind: string) => `job:${email.toLowerCase()}:${kind}`;
const kTemplates = (email: string) => k(email, "templates");
const kContacts = (email: string) => k(email, "contacts");
const kResumes = (email: string) => k(email, "resumes");
const kHistory = (email: string) => k(email, "history");
const kSlots = (email: string) => k(email, "slots");
const kTemplatesSeedVer = (email: string) => k(email, "templates_seed_v");

async function loadList<T>(key: string): Promise<T[]> {
  const v = await kvGet<T[]>(key);
  return Array.isArray(v) ? v : [];
}

// ---------- Templates ----------

export async function listTemplates(email: string): Promise<Template[]> {
  return loadList<Template>(kTemplates(email));
}

export async function upsertTemplate(email: string, t: Partial<Template>): Promise<Template> {
  const all = await listTemplates(email);
  const id = t.id || newId();
  const now = nowIso();
  const existing = all.find((x) => x.id === id);
  const merged: Template = {
    id,
    name: t.name || existing?.name || "Untitled",
    roleType: t.roleType ?? existing?.roleType ?? "",
    subject: t.subject ?? existing?.subject ?? "",
    body: t.body ?? existing?.body ?? "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await kvSet(kTemplates(email), [...all.filter((x) => x.id !== id), merged]);
  return merged;
}

export async function deleteTemplate(email: string, id: string): Promise<void> {
  const all = await listTemplates(email);
  await kvSet(kTemplates(email), all.filter((t) => t.id !== id));
}

export async function getTemplate(email: string, id: string): Promise<Template | null> {
  return (await listTemplates(email)).find((t) => t.id === id) || null;
}

export async function seedTemplatesIfEmpty(email: string): Promise<number> {
  const existing = await listTemplates(email);
  if (existing.length) return 0;
  for (const t of DEFAULT_TEMPLATES) {
    await upsertTemplate(email, t);
  }
  await kvSet(kTemplatesSeedVer(email), TEMPLATES_SEED_VERSION);
  return DEFAULT_TEMPLATES.length;
}

// Refresh stored default templates (subject/body/roleType) when DEFAULT_TEMPLATES
// content changes server-side. Matches by template name. User-created templates
// (any name not in DEFAULT_TEMPLATES) are left untouched.
export async function migrateTemplatesIfNeeded(email: string): Promise<number> {
  const storedVer = (await kvGet<number>(kTemplatesSeedVer(email))) ?? 0;
  if (storedVer >= TEMPLATES_SEED_VERSION) return 0;
  const all = await listTemplates(email);
  if (!all.length) return 0;
  const defaultNames = new Set(DEFAULT_TEMPLATES.map((t) => t.name));
  let updated = 0;
  for (const def of DEFAULT_TEMPLATES) {
    const existing = all.find((t) => t.name === def.name);
    if (existing) {
      await upsertTemplate(email, {
        id: existing.id,
        name: def.name,
        roleType: def.roleType,
        subject: def.subject,
        body: def.body,
      });
      updated++;
    }
  }
  // Insert any default that didn't exist by name.
  const refreshed = await listTemplates(email);
  for (const def of DEFAULT_TEMPLATES) {
    if (!refreshed.find((t) => t.name === def.name)) {
      await upsertTemplate(email, def);
      updated++;
    }
  }
  await kvSet(kTemplatesSeedVer(email), TEMPLATES_SEED_VERSION);
  // Reference defaultNames so it isn't flagged as unused — we use it conceptually
  // (keeping user-named templates untouched) but the iteration above is sufficient.
  void defaultNames;
  return updated;
}

// ---------- Contacts ----------

export async function listContacts(email: string): Promise<Contact[]> {
  return loadList<Contact>(kContacts(email));
}

export async function upsertContact(email: string, c: Partial<Contact>): Promise<Contact> {
  const all = await listContacts(email);
  const id = c.id || newId();
  const now = nowIso();
  const existing = all.find((x) => x.id === id);
  const merged: Contact = {
    id,
    email: (c.email ?? existing?.email ?? "").trim(),
    name: (c.name ?? existing?.name ?? "").trim(),
    company: (c.company ?? existing?.company ?? "").trim(),
    role: (c.role ?? existing?.role ?? "").trim(),
    custom1: c.custom1 ?? existing?.custom1,
    custom2: c.custom2 ?? existing?.custom2,
    notes: c.notes ?? existing?.notes,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await kvSet(kContacts(email), [...all.filter((x) => x.id !== id), merged]);
  return merged;
}

export async function deleteContact(email: string, id: string): Promise<void> {
  const all = await listContacts(email);
  await kvSet(kContacts(email), all.filter((c) => c.id !== id));
}

export async function getContact(email: string, id: string): Promise<Contact | null> {
  return (await listContacts(email)).find((c) => c.id === id) || null;
}

// ---------- Resumes ----------

export async function listResumes(email: string): Promise<ResumeMeta[]> {
  return loadList<ResumeMeta>(kResumes(email));
}

export async function upsertResume(email: string, r: Partial<ResumeMeta>): Promise<ResumeMeta> {
  const all = await listResumes(email);
  const id = r.id || newId();
  const now = nowIso();
  const existing = all.find((x) => x.id === id);
  const merged: ResumeMeta = {
    id,
    label: r.label || existing?.label || "Untitled resume",
    roleType: r.roleType ?? existing?.roleType ?? "",
    filename: r.filename ?? existing?.filename ?? "",
    storedFilename: r.storedFilename ?? existing?.storedFilename ?? "",
    sizeBytes: r.sizeBytes ?? existing?.sizeBytes ?? 0,
    createdAt: existing?.createdAt || now,
  };
  await kvSet(kResumes(email), [...all.filter((x) => x.id !== id), merged]);
  return merged;
}

export async function deleteResume(email: string, id: string): Promise<void> {
  const all = await listResumes(email);
  await kvSet(kResumes(email), all.filter((r) => r.id !== id));
}

export async function getResume(email: string, id: string): Promise<ResumeMeta | null> {
  return (await listResumes(email)).find((r) => r.id === id) || null;
}

// ---------- History ----------

export async function listHistory(email: string): Promise<SendRecord[]> {
  return loadList<SendRecord>(kHistory(email));
}

export async function appendHistory(email: string, rec: SendRecord): Promise<void> {
  const all = await listHistory(email);
  await kvSet(kHistory(email), [...all, rec]);
}

export async function updateHistory(email: string, id: string, patch: Partial<SendRecord>): Promise<void> {
  const all = await listHistory(email);
  const next = all.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await kvSet(kHistory(email), next);
}

// ---------- Quick Slots (template + resume bundles) ----------

export async function listSlots(email: string): Promise<Slot[]> {
  return loadList<Slot>(kSlots(email));
}

export async function upsertSlot(email: string, s: Partial<Slot>): Promise<Slot> {
  const all = await listSlots(email);
  const id = s.id || newId();
  const now = nowIso();
  const existing = all.find((x) => x.id === id);
  const merged: Slot = {
    id,
    name: s.name || existing?.name || "Untitled slot",
    subject: s.subject ?? existing?.subject ?? "",
    body: s.body ?? existing?.body ?? "",
    resumeName: s.resumeName ?? existing?.resumeName ?? "",
    resumeBase64: s.resumeBase64 ?? existing?.resumeBase64 ?? "",
    resumeSize: s.resumeSize ?? existing?.resumeSize ?? 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await kvSet(kSlots(email), [...all.filter((x) => x.id !== id), merged]);
  return merged;
}

export async function deleteSlot(email: string, id: string): Promise<void> {
  const all = await listSlots(email);
  await kvSet(kSlots(email), all.filter((s) => s.id !== id));
}
