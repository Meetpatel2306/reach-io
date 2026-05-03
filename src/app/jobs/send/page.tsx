"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Send, AlertTriangle, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  fetchContacts,
  fetchHistory,
  fetchResumes,
  fetchTemplates,
  loadSavedSmtp,
  saveContact,
  sendApplications,
  type SendResponse,
} from "../_lib/client";
import { getValidAccessToken, loadOAuth } from "@/lib/oauth";
import {
  alreadyContacted,
  buildContext,
  render,
  suggestResume,
  suggestTemplate,
  type Contact,
  type ResumeMeta,
  type SendRecord,
  type Template,
} from "@/lib/jobAppShared";

type Mode = "saved" | "quick";

interface QuickContact {
  email: string;
  name: string;
  company: string;
  role: string;
  custom1: string;
  saveToContacts: boolean;
}

const QUICK_EMPTY: QuickContact = { email: "", name: "", company: "", role: "", custom1: "", saveToContacts: true };

export default function SendPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [resumes, setResumes] = useState<ResumeMeta[]>([]);
  const [history, setHistory] = useState<SendRecord[]>([]);
  const [mode, setMode] = useState<Mode>("saved");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [quick, setQuick] = useState<QuickContact>(QUICK_EMPTY);
  const [templateId, setTemplateId] = useState<string>("");
  const [resumeId, setResumeId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [tpls, cts, res, hist] = await Promise.all([fetchTemplates(), fetchContacts(), fetchResumes(), fetchHistory()]);
      setTemplates(tpls);
      setContacts(cts);
      setResumes(res);
      setHistory(hist);
    })().catch((e) => setError(String(e)));
  }, []);

  // Auto-suggest based on first chosen contact's role.
  const sampleRole = useMemo(() => {
    if (mode === "quick") return quick.role;
    const first = contacts.find((c) => c.id === selectedContactIds[0]);
    return first?.role || "";
  }, [mode, quick.role, selectedContactIds, contacts]);

  const suggestedTemplate = useMemo(() => suggestTemplate(sampleRole, templates), [sampleRole, templates]);
  const suggestedResume = useMemo(() => suggestResume(sampleRole, resumes), [sampleRole, resumes]);

  // Apply suggestions when selection changes (only if user hasn't manually overridden).
  useEffect(() => {
    if (suggestedTemplate && !templateId) setTemplateId(suggestedTemplate.id);
  }, [suggestedTemplate, templateId]);
  useEffect(() => {
    if (suggestedResume && !resumeId) setResumeId(suggestedResume.id);
  }, [suggestedResume, resumeId]);

  // Manual overrides on selection: re-apply suggestion when sampleRole changes.
  useEffect(() => {
    if (suggestedTemplate) setTemplateId(suggestedTemplate.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRole]);
  useEffect(() => {
    if (suggestedResume) setResumeId(suggestedResume.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRole]);

  const template = templates.find((t) => t.id === templateId);
  const resume = resumes.find((r) => r.id === resumeId) || null;

  const previewContact: Pick<Contact, "name" | "email" | "company" | "role" | "custom1" | "custom2"> = useMemo(() => {
    if (mode === "quick") {
      return { name: quick.name, email: quick.email, company: quick.company, role: quick.role, custom1: quick.custom1, custom2: "" };
    }
    const first = contacts.find((c) => c.id === selectedContactIds[0]);
    return first || { name: "", email: "", company: "", role: "", custom1: "", custom2: "" };
  }, [mode, quick, selectedContactIds, contacts]);

  const previewSubject = template ? render(template.subject, buildContext(previewContact)) : "";
  const previewBody = template ? render(template.body, buildContext(previewContact)) : "";

  const recipientCount = mode === "quick" ? (quick.email ? 1 : 0) : selectedContactIds.length;

  const duplicateWarnings = useMemo(() => {
    const emails = mode === "quick" ? (quick.email ? [quick.email] : []) : contacts.filter((c) => selectedContactIds.includes(c.id)).map((c) => c.email);
    return emails.flatMap((e) => {
      const recent = alreadyContacted(history, e, 14);
      return recent.length ? [`${e} — already emailed ${recent.length} time(s) in the last 14 days`] : [];
    });
  }, [mode, quick.email, selectedContactIds, contacts, history]);

  async function handleSend() {
    setError(""); setResult(null);
    if (!template) { setError("Pick a template."); return; }

    let contactIds: string[] = [];
    if (mode === "quick") {
      if (!quick.email || !quick.company || !quick.role) { setError("Email, company, and role are required."); return; }
      // Save the quick contact so we have an ID to attach to history.
      const saved = await saveContact({
        email: quick.email, name: quick.name, company: quick.company, role: quick.role,
        custom1: quick.custom1, custom2: "",
      });
      contactIds = [saved.id];
      if (quick.saveToContacts) {
        // refresh contacts list silently
        fetchContacts().then(setContacts).catch(() => {});
      }
      // Reset quick form for the next send.
    } else {
      if (!selectedContactIds.length) { setError("Pick at least one recipient."); return; }
      contactIds = selectedContactIds;
    }

    // Credentials: prefer Google OAuth, fall back to saved SMTP.
    const oauth = loadOAuth();
    const validToken = oauth ? await getValidAccessToken() : null;
    const smtp = loadSavedSmtp();

    if (!validToken && !(smtp?.smtpUser && smtp?.smtpPass)) {
      setError("No sending credentials. Sign in with Google or set SMTP on the main page first.");
      return;
    }

    setSending(true);
    try {
      const r = await sendApplications({
        templateId: template.id,
        contactIds,
        resumeId: resume?.id || null,
        oauthAccessToken: validToken || undefined,
        oauthEmail: oauth?.email || undefined,
        smtpUser: smtp?.smtpUser,
        smtpPass: smtp?.smtpPass,
        smtpHost: smtp?.smtpHost,
        smtpPort: smtp?.smtpPort,
        smtpSecurity: smtp?.smtpSecurity,
      });
      setResult(r);
      // Reset selection on success
      if (r.failed === 0) {
        if (mode === "quick") setQuick(QUICK_EMPTY);
        else setSelectedContactIds([]);
      }
      // Refresh history so duplicate warnings stay accurate.
      fetchHistory().then(setHistory).catch(() => {});
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Send Application</h2>
        <p className="text-sm text-slate-400">Pick recipients → template + resume auto-suggest → one click.</p>
      </div>

      {!templates.length && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg p-3 text-sm">
          No templates yet. <Link href="/jobs/templates" className="underline">Create one</Link>.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT — recipients */}
        <section className="space-y-3">
          <h3 className="font-medium">1. Pick recipients</h3>
          <div className="flex gap-1 bg-slate-900/40 border border-slate-800 p-1 rounded-md w-fit text-sm">
            <button onClick={() => setMode("saved")} className={`px-3 py-1 rounded ${mode === "saved" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>Saved contacts</button>
            <button onClick={() => setMode("quick")} className={`px-3 py-1 rounded ${mode === "quick" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>Quick send</button>
          </div>

          {mode === "saved" ? (
            contacts.length === 0 ? (
              <p className="text-sm text-slate-500">No saved contacts. <Link href="/jobs/contacts" className="text-indigo-300 underline">Add some</Link>.</p>
            ) : (
              <div className="border border-slate-800 rounded-md max-h-[420px] overflow-y-auto">
                {contacts.map((c) => {
                  const checked = selectedContactIds.includes(c.id);
                  return (
                    <label key={c.id} className={`flex items-start gap-2 p-3 border-b border-slate-800 cursor-pointer hover:bg-slate-900/40 ${checked ? "bg-indigo-600/10" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedContactIds([...selectedContactIds, c.id]);
                          else setSelectedContactIds(selectedContactIds.filter((id) => id !== c.id));
                        }}
                      />
                      <div className="text-sm flex-1 min-w-0">
                        <p className="font-medium truncate">{c.name || c.email}</p>
                        <p className="text-xs text-slate-400 truncate">{c.email} · {c.company} · {c.role}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-3 border border-slate-800 rounded-md p-3 bg-slate-900/40">
              <Field label="Email *"><input className="input" value={quick.email} onChange={(e) => setQuick({ ...quick, email: e.target.value })} /></Field>
              <Field label="Name"><input className="input" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} /></Field>
              <Field label="Company *"><input className="input" value={quick.company} onChange={(e) => setQuick({ ...quick, company: e.target.value })} /></Field>
              <Field label="Role *"><input className="input" value={quick.role} onChange={(e) => setQuick({ ...quick, role: e.target.value })} /></Field>
              <div className="col-span-2"><Field label="custom1 (one specific reason — used in AI/ML template)"><input className="input" value={quick.custom1} onChange={(e) => setQuick({ ...quick, custom1: e.target.value })} /></Field></div>
              <label className="col-span-2 flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={quick.saveToContacts} onChange={(e) => setQuick({ ...quick, saveToContacts: e.target.checked })} />
                Also save to Contacts for later
              </label>
            </div>
          )}
        </section>

        {/* RIGHT — template + resume */}
        <section className="space-y-3">
          <h3 className="font-medium">2. Pick template &amp; resume</h3>

          <Field label="Template">
            <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— pick one —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{suggestedTemplate?.id === t.id ? "  ⭐ suggested" : ""}</option>
              ))}
            </select>
          </Field>

          <Field label="Resume to attach">
            <select className="input" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">— no attachment —</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>{r.label}{suggestedResume?.id === r.id ? "  ⭐ suggested" : ""}</option>
              ))}
            </select>
          </Field>

          {(suggestedTemplate || suggestedResume) && sampleRole && (
            <p className="text-xs text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Auto-suggested based on role: <span className="font-medium">{sampleRole}</span>
            </p>
          )}
        </section>
      </div>

      {/* Preview */}
      {template && (mode === "quick" ? quick.email : selectedContactIds.length > 0) && (
        <section className="space-y-3">
          <h3 className="font-medium">3. Preview (rendered for first recipient)</h3>
          <div className="border border-slate-800 rounded-md p-3 bg-slate-900/40 space-y-2">
            <p className="text-xs text-slate-500">Subject</p>
            <p className="text-sm">{previewSubject}</p>
          </div>
          <div className="border border-slate-800 rounded-md p-3 bg-slate-900/40">
            <p className="text-xs text-slate-500 mb-2">Body</p>
            <pre className="text-sm whitespace-pre-wrap font-sans">{previewBody}</pre>
          </div>
        </section>
      )}

      {duplicateWarnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 space-y-1">
          {duplicateWarnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      {result && (
        <div className={`rounded-md p-3 text-sm space-y-1 border ${result.failed === 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-rose-500/10 border-rose-500/30 text-rose-200"}`}>
          <p className="flex items-center gap-2">
            {result.failed === 0 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            Sent {result.sent} of {result.total}{result.failed > 0 ? ` (${result.failed} failed)` : ""}.
          </p>
          {result.results.filter((r) => r.status === "failed").map((r) => (
            <p key={r.recordId} className="text-xs opacity-80">• {r.email}: {r.error}</p>
          ))}
        </div>
      )}

      <div className="sticky bottom-4 z-10">
        <button
          onClick={handleSend}
          disabled={sending || !templateId || recipientCount === 0}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-md text-sm font-medium disabled:opacity-50 shadow-lg shadow-indigo-900/30"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : `Send to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
        </button>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: rgb(15 23 42 / 0.6);
          border: 1px solid rgb(30 41 59);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          color: rgb(241 245 249);
          font-size: 0.875rem;
        }
        :global(.input:focus) { outline: 1px solid rgb(99 102 241); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
