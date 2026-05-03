// Tiny fetch helpers + shared types used across the /jobs/* pages.
"use client";

import type { Contact, ResumeMeta, SendRecord, Template, FollowUpEntry } from "@/lib/jobAppShared";

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error((await r.json()).error || `${url} ${r.status}`);
  return r.json();
}
async function jpost<T>(url: string, body: unknown, isForm = false): Promise<T> {
  const init: RequestInit = isForm
    ? { method: "POST", body: body as FormData }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const r = await fetch(url, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${url} ${r.status}`);
  return data as T;
}
async function jput<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${url} ${r.status}`);
  return data as T;
}
async function jdel<T>(url: string): Promise<T> {
  const r = await fetch(url, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${url} ${r.status}`);
  return data as T;
}

// ---- Templates ----
export const fetchTemplates = () => jget<{ templates: Template[] }>("/api/jobs/templates").then((d) => d.templates);
export const saveTemplate = (t: Partial<Template>) => jpost<{ template: Template }>("/api/jobs/templates", t).then((d) => d.template);
export const updateTemplate = (id: string, t: Partial<Template>) => jput<{ template: Template }>(`/api/jobs/templates/${id}`, t).then((d) => d.template);
export const removeTemplate = (id: string) => jdel<{ success: boolean }>(`/api/jobs/templates/${id}`);

// ---- Contacts ----
export const fetchContacts = () => jget<{ contacts: Contact[] }>("/api/jobs/contacts").then((d) => d.contacts);
export const saveContact = (c: Partial<Contact>) => jpost<{ contact: Contact }>("/api/jobs/contacts", c).then((d) => d.contact);
export const updateContact = (id: string, c: Partial<Contact>) => jput<{ contact: Contact }>(`/api/jobs/contacts/${id}`, c).then((d) => d.contact);
export const removeContact = (id: string) => jdel<{ success: boolean }>(`/api/jobs/contacts/${id}`);
export const importContactsCsv = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return jpost<{ imported: number }>("/api/jobs/contacts/import", fd, true);
};

// ---- Resumes ----
export const fetchResumes = () => jget<{ resumes: ResumeMeta[] }>("/api/jobs/resumes").then((d) => d.resumes);
export const uploadResume = (file: File, label: string, roleType: string) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("label", label);
  fd.append("roleType", roleType);
  return jpost<{ resume: ResumeMeta }>("/api/jobs/resumes", fd, true).then((d) => d.resume);
};
export const removeResume = (id: string) => jdel<{ success: boolean }>(`/api/jobs/resumes/${id}`);

// ---- Send + History + Follow-ups ----
export interface SendRequest {
  templateId: string;
  contactIds: string[];
  resumeId: string | null;
  isFollowUp?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: string;
  oauthAccessToken?: string;
  oauthEmail?: string;
}
export interface SendResponse {
  sent: number;
  failed: number;
  total: number;
  results: { contactId: string; email: string; status: "sent" | "failed"; error?: string; recordId: string }[];
}
export const sendApplications = (body: SendRequest) => jpost<SendResponse>("/api/jobs/send", body);
export const fetchHistory = () => jget<{ history: SendRecord[] }>("/api/jobs/history").then((d) => d.history);
export const fetchFollowUps = (days = 7) => jget<{ followUps: FollowUpEntry[] }>(`/api/jobs/followups?days=${days}`).then((d) => d.followUps);
export const markFollowUpDone = (recordId: string) => jpost<{ success: boolean }>(`/api/jobs/followups/${recordId}/done`, {});

// ---- SMTP credentials (read from localStorage; same keys main page uses) ----
export interface SmtpConfig {
  smtpUser: string;
  smtpPass: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
}

export function loadSavedSmtp(): SmtpConfig | null {
  try {
    const raw = localStorage.getItem("email-blaster-smtp");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      smtpUser: parsed.smtpUser || "",
      smtpPass: parsed.smtpPass || "",
      smtpHost: parsed.smtpHost || "smtp.gmail.com",
      smtpPort: parseInt(parsed.smtpPort || "587"),
      smtpSecurity: parsed.smtpSecurity || "starttls",
    };
  } catch {
    return null;
  }
}
