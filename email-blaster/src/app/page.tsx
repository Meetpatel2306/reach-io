"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText, Upload, Mail, Send, Users, Check, X, Trash2,
  Save, ChevronRight, ChevronLeft, Download, Activity,
  Clock, Paperclip, Eye, EyeOff, Settings, Loader2, History,
  Zap, HelpCircle, Shield
} from "lucide-react";
import Link from "next/link";
import { saveToHistory } from "@/lib/history";
import type { EmailResult } from "@/lib/history";

interface Recipient { name: string; email: string; }
interface SendResult { email: string; status: string; error?: string; }
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface SavedSmtp {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpSecurity: string;
}

interface SavedState {
  subject: string;
  body: string;
  emailSaved: boolean;
  resumeSaved: boolean;
  resumeName: string;
  resumeSize: number;
  resumeFilename: string;
  resumeBase64: string;
  recipients: Recipient[];
}

const STATIC_SUBJECT = "";
const STATIC_BODY = "";

const STORAGE_KEY = "email-blaster-state";
const SMTP_STORAGE_KEY = "email-blaster-smtp";

function loadSmtp(): SavedSmtp | null {
  try {
    const raw = localStorage.getItem(SMTP_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSmtp(config: SavedSmtp) {
  try { localStorage.setItem(SMTP_STORAGE_KEY, JSON.stringify(config)); } catch {}
}

function clearSmtp() {
  try { localStorage.removeItem(SMTP_STORAGE_KEY); } catch {}
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveState(state: SavedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// Convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert base64 back to File
function base64ToFile(base64: string, name: string): File {
  const [meta, data] = base64.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "application/pdf";
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

export default function Home() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeFilename, setResumeFilename] = useState("");
  const [resumeSaved, setResumeSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const resumeRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState(STATIC_SUBJECT);
  const [body, setBody] = useState(STATIC_BODY);
  const [emailSaved, setEmailSaved] = useState(false);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [manualEmails, setManualEmails] = useState("");
  const [csvFormat, setCsvFormat] = useState<"name,email" | "email,name">("name,email");

  const [smtpUser, setSmtpUser] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecurity, setSmtpSecurity] = useState("starttls");
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState("");
  const [minDelay, setMinDelay] = useState(2);
  const [maxDelay, setMaxDelay] = useState(5);

  // Tour
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<SendResult[]>([]);

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Persist state to localStorage whenever key values change
  const persistState = useCallback(async () => {
    if (restoring) return;
    let resumeBase64 = "";
    if (resumeFile && resumeSaved) {
      try { resumeBase64 = await fileToBase64(resumeFile); } catch {}
    }
    saveState({
      subject, body, emailSaved, resumeSaved,
      resumeName: resumeFile?.name || "",
      resumeSize: resumeFile?.size || 0,
      resumeFilename,
      resumeBase64,
      recipients,
    });
  }, [subject, body, emailSaved, resumeSaved, resumeFile, resumeFilename, recipients, restoring]);

  useEffect(() => { persistState(); }, [persistState]);

  // Restore state on mount
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setSubject(saved.subject);
      setBody(saved.body);
      setEmailSaved(saved.emailSaved);
      setRecipients(saved.recipients || []);

      if (saved.resumeSaved && saved.resumeBase64 && saved.resumeName) {
        const file = base64ToFile(saved.resumeBase64, saved.resumeName);
        setResumeFile(file);
        setResumeSaved(true);

        // Re-upload resume to server so it's available for sending
        const fd = new FormData();
        fd.append("resume", file);
        fetch("/api/upload-resume", { method: "POST", body: fd })
          .then((r) => r.json())
          .then((data) => {
            if (data.filename) setResumeFilename(data.filename);
          })
          .catch(() => {});

        // Jump to appropriate step
        if (saved.emailSaved && saved.recipients?.length > 0) setCurrentStep(4);
        else if (saved.emailSaved) setCurrentStep(3);
        else setCurrentStep(2);
      }
    }
    setRestoring(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load SMTP config: ONLY from localStorage (single source of truth)
  useEffect(() => {
    const saved = loadSmtp();
    if (saved && saved.smtpUser && saved.smtpPass) {
      setSmtpUser(saved.smtpUser.trim());
      setSmtpHost(saved.smtpHost?.trim() || "smtp.gmail.com");
      setSmtpPort(saved.smtpPort?.trim() || "587");
      setSmtpPass(saved.smtpPass.trim());
      setSmtpSecurity(saved.smtpSecurity?.trim() || "starttls");
      setSmtpConfigured(true);
    }
    // No env var fallback — user must configure via UI settings
  }, []);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const saveSmtpConfig = async () => {
    if (!smtpUser || !smtpPass) { setSmtpMsg("Email and password are required"); return; }
    setSavingSmtp(true);
    setSmtpMsg("");
    try {
      const res = await fetch("/api/smtp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpPass, smtpSecurity }),
      });
      const data = await res.json();
      if (data.error) { setSmtpMsg(data.error); }
      else {
        saveSmtp({ smtpHost, smtpPort, smtpUser, smtpPass, smtpSecurity });
        setSmtpMsg("Verified & Saved!");
        setSmtpConfigured(true);
        addLog("SMTP config saved & verified");
      }
    } catch { setSmtpMsg("Failed to verify connection"); }
    setSavingSmtp(false);
  };

  const testSmtpConnection = async () => {
    if (!smtpUser || !smtpPass) { setSmtpMsg("Email and password are required"); return; }
    setTestingSmtp(true);
    setSmtpMsg("");
    try {
      const res = await fetch("/api/smtp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpPass, smtpSecurity }),
      });
      const data = await res.json();
      if (data.error) { setSmtpMsg(data.error); }
      else { setSmtpMsg("Connection successful! Credentials are valid."); addLog("SMTP test passed"); }
    } catch { setSmtpMsg("Failed to test connection"); }
    setTestingSmtp(false);
  };

  const deleteSmtpConfig = () => {
    clearSmtp();
    setSmtpConfigured(false);
    setSmtpUser("");
    setSmtpPass("");
    setSmtpHost("smtp.gmail.com");
    setSmtpPort("587");
    setSmtpSecurity("starttls");
    setSmtpMsg("Config removed");
    addLog("SMTP config removed");
  };

  // Tour steps
  const tourSteps = [
    { title: "Welcome to Email Blaster Pro!", desc: "A powerful tool to send bulk emails with resume attachments. Let's take a quick tour of all features.", icon: Send },
    { title: "SMTP Settings", desc: "First, configure your email credentials. Click the gear icon in the header. Use 'Test Connection' to verify without saving, or 'Save Config' to save & verify.", icon: Settings },
    { title: "Step 1: Upload Resume", desc: "Upload your resume (PDF, DOC, DOCX). It gets attached to every email you send. Saved in your browser for next time.", icon: FileText },
    { title: "Step 2: Compose Email", desc: "Write your email subject and body. This same content goes to all recipients. Everything auto-saves to your browser.", icon: Mail },
    { title: "Step 3: Add Recipients", desc: "Add recipients manually (one per line) or upload a CSV file. Supports 'Name <email>' format and bulk CSV imports.", icon: Users },
    { title: "Step 4: Send", desc: "Review your settings, adjust delay between emails (to avoid spam filters), and hit Send. Watch real-time progress in the Activity log.", icon: Send },
    { title: "Send History", desc: "Click the clock icon to view all past sends. Group by batch or by email, search, filter, sort — see who got your email and when.", icon: History },
    { title: "You're all set!", desc: "Start by configuring your SMTP settings. For Gmail, use an App Password from myaccount.google.com/apppasswords. Happy emailing!", icon: Zap },
  ];

  // Show tour on first visit
  useEffect(() => {
    const tourSeen = localStorage.getItem("email-blaster-tour-seen");
    if (!tourSeen) setShowTour(true);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const r = await installPrompt.userChoice;
    if (r.outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev]);
  };

  const handleResumeUpload = async (file: File) => {
    setResumeFile(file);
    setUploading(true);
    addLog(`Uploading: ${file.name}...`);
    const fd = new FormData();
    fd.append("resume", file);
    try {
      const res = await fetch("/api/upload-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { addLog(`ERROR: ${data.error}`); setUploading(false); return; }
      setResumeFilename(data.filename);
      addLog(`Resume uploaded: ${file.name}`);
    } catch (err: unknown) {
      addLog(`ERROR: ${err instanceof Error ? err.message : "Failed"}`);
    }
    setUploading(false);
  };

  const saveResume = () => {
    setResumeSaved(true);
    addLog("Resume saved");
    if (emailSaved) setCurrentStep(3);
    else setCurrentStep(2);
  };

  const removeResume = () => {
    setResumeFile(null); setResumeFilename(""); setResumeSaved(false);
    if (resumeRef.current) resumeRef.current.value = "";
    addLog("Resume removed"); setCurrentStep(1);
  };

  const saveEmail = () => { setEmailSaved(true); addLog("Email saved"); setCurrentStep(3); };
  const unsaveEmail = () => { setEmailSaved(false); setCurrentStep(2); };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const parsed: Recipient[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
        if (cols.length >= 2) {
          if (csvFormat === "name,email") parsed.push({ name: cols[0], email: cols[1] });
          else parsed.push({ name: cols[1], email: cols[0] });
        } else if (cols.length === 1 && cols[0].includes("@")) {
          parsed.push({ name: "", email: cols[0] });
        }
      }
      setRecipients((prev) => [...prev, ...parsed]);
      addLog(`${parsed.length} recipients from CSV`);
    };
    reader.readAsText(file);
  };

  const parseManualEmails = () => {
    if (!manualEmails.trim()) return;
    const parsed: Recipient[] = [];
    for (const line of manualEmails.split("\n").filter((l) => l.trim())) {
      const match = line.trim().match(/^(.+?)\s*<(.+?)>$/);
      if (match) parsed.push({ name: match[1].trim(), email: match[2].trim() });
      else if (line.includes("@")) parsed.push({ name: "", email: line.trim() });
    }
    setRecipients((prev) => [...prev, ...parsed]);
    setManualEmails("");
    addLog(`${parsed.length} recipients added`);
  };

  const handleSend = async () => {
    if (!recipients.length || !subject || !body) return;
    if (!smtpConfigured) {
      addLog("ERROR: SMTP not configured. Open Settings first.");
      setShowSettings(true);
      return;
    }
    setSending(true); setResults([]);
    addLog(`Sending to ${recipients.length} recipients...`);
    const startTime = Date.now();
    const fd = new FormData();
    fd.append("recipients", JSON.stringify(recipients));
    fd.append("subject", subject);
    fd.append("body", body);
    fd.append("minDelay", minDelay.toString());
    fd.append("maxDelay", maxDelay.toString());
    if (resumeFilename) fd.append("resumeFilename", resumeFilename);
    if (resumeFile) fd.append("resumeFile", resumeFile);

    // Send SMTP creds from localStorage
    const smtp = loadSmtp();
    if (smtp && smtp.smtpUser && smtp.smtpPass) {
      fd.append("smtpHost", smtp.smtpHost);
      fd.append("smtpPort", smtp.smtpPort);
      fd.append("smtpUser", smtp.smtpUser);
      fd.append("smtpPass", smtp.smtpPass);
      fd.append("smtpSecurity", smtp.smtpSecurity);
    }
    try {
      const res = await fetch("/api/send-email", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { addLog(`ERROR: ${data.error}`); }
      else {
        setResults(data.results || []);
        addLog(`Done! Sent: ${data.sent}, Failed: ${data.failed}`);
        for (const r of data.results || [])
          addLog(r.status === "sent" ? `Sent -> ${r.email}` : `FAILED -> ${r.email}: ${r.error}`);

        // Save to history
        const historyResults: EmailResult[] = (data.results || []).map((r: SendResult) => {
          const recipient = recipients.find((rec) => rec.email === r.email);
          return { email: r.email, name: recipient?.name || "", status: r.status as "sent" | "failed", error: r.error };
        });
        saveToHistory({
          id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          subject,
          body,
          from: smtp?.smtpUser || smtpUser || "",
          hasAttachment: !!(resumeFile && resumeSaved),
          attachmentName: resumeFile?.name || "",
          totalRecipients: recipients.length,
          sent: data.sent,
          failed: data.failed,
          results: historyResults,
          durationMs: Date.now() - startTime,
        });
      }
    } catch (err: unknown) {
      addLog(`ERROR: ${err instanceof Error ? err.message : "Network error"}`);
    }
    setSending(false);
  };

  const sentCount = results.filter((r) => r.status === "sent").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  const steps = [
    { num: 1, label: "Resume", icon: FileText, done: resumeSaved },
    { num: 2, label: "Email", icon: Mail, done: emailSaved },
    { num: 3, label: "Recipients", icon: Users, done: recipients.length > 0 },
    { num: 4, label: "Send", icon: Send, done: results.length > 0 },
  ];

  // Show loading skeleton while restoring state
  if (restoring) return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse">
          <Send size={20} className="text-white" />
        </div>
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Send size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Email Blaster Pro</h1>
            {smtpUser && <p className="text-slate-500 text-xs">{smtpUser}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {results.length > 0 && (
            <div className="flex gap-2">
              <span className="badge badge-success flex items-center gap-1"><Check size={12} />{sentCount}</span>
              {failedCount > 0 && <span className="badge badge-error flex items-center gap-1"><X size={12} />{failedCount}</span>}
            </div>
          )}
          <Link
            href="/history"
            className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all"
            title="Send History"
          >
            <History size={18} />
          </Link>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg border transition-all ${
              smtpConfigured
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            } hover:brightness-125`}
            title="SMTP Settings"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => { setShowTour(true); setTourStep(0); }}
            className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all"
            title="Product Tour"
          >
            <HelpCircle size={18} />
          </button>
          {!isInstalled && installPrompt && (
            <button onClick={handleInstall} className="btn-primary text-sm flex items-center gap-1.5"><Download size={14} />Install</button>
          )}
        </div>
      </div>

      {/* PWA Banner */}
      {!isInstalled && installPrompt && (
        <div className="install-banner mb-6">
          <div className="flex items-center gap-3">
            <Download size={20} className="text-indigo-400" />
            <div>
              <p className="font-semibold text-sm">Install as Desktop App</p>
              <p className="text-xs text-slate-400">Quick access anytime</p>
            </div>
          </div>
          <button onClick={handleInstall} className="btn-primary text-sm">Install</button>
        </div>
      )}

      {/* SMTP Settings Panel */}
      {showSettings && (
        <div className="glass-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings size={20} className="text-violet-400" />
              <h2 className="text-lg font-semibold text-white">SMTP Settings</h2>
              {smtpConfigured && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Connected</span>
              )}
            </div>
            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Email Address</label>
              <input className="input-field" type="email" placeholder="you@gmail.com" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">App Password</label>
              <div className="relative">
                <input className="input-field pr-10" type={showPass ? "text" : "password"} placeholder="Enter app password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">SMTP Host</label>
              <input className="input-field" placeholder="smtp.gmail.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Port</label>
                <input className="input-field" placeholder="587" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Security</label>
                <select className="input-field" value={smtpSecurity} onChange={(e) => setSmtpSecurity(e.target.value)}>
                  <option value="starttls">STARTTLS</option>
                  <option value="ssl">SSL/TLS</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>

          {smtpMsg && (
            <p className={`text-sm mt-3 ${smtpMsg.includes("successful") || smtpMsg.includes("Verified") || smtpMsg.includes("Saved") ? "text-emerald-400" : smtpMsg.includes("removed") ? "text-amber-400" : "text-red-400"}`}>{smtpMsg}</p>
          )}

          <div className="flex gap-3 mt-4 flex-wrap">
            <button
              onClick={testSmtpConnection}
              disabled={testingSmtp || !smtpUser || !smtpPass}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm hover:bg-blue-500/20 transition-all font-medium"
            >
              {testingSmtp ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
              {testingSmtp ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={saveSmtpConfig}
              disabled={savingSmtp || !smtpUser || !smtpPass}
              className="btn-primary flex items-center gap-1.5"
            >
              {savingSmtp ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {savingSmtp ? "Saving..." : "Save Config"}
            </button>
            {smtpConfigured && (
              <button onClick={deleteSmtpConfig} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm hover:bg-red-500/20 transition-all">
                <Trash2 size={14} />Remove
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-600 mt-3">For Gmail, use an App Password from myaccount.google.com/apppasswords</p>
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.num} className="flex items-center">
              <button
                onClick={() => setCurrentStep(s.num)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  s.done
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : currentStep === s.num
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/5"
                    : "bg-slate-800/50 text-slate-500 border border-slate-700/50"
                }`}
              >
                {s.done ? <Check size={16} /> : <Icon size={16} />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && <ChevronRight size={16} className="text-slate-700 mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Step 1: Resume */}
          {currentStep === 1 && (
            <div className="glass-card">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={20} className="text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Resume</h2>
              </div>

              {resumeSaved && resumeFile ? (
                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Paperclip size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-emerald-300 font-medium text-sm">{resumeFile.name}</p>
                      <p className="text-xs text-slate-500">{(resumeFile.size / 1024).toFixed(1)} KB — Saved</p>
                    </div>
                  </div>
                  <button onClick={removeResume} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm hover:bg-red-500/20 transition-all">
                    <Trash2 size={14} />Remove
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="upload-zone group"
                    onClick={() => resumeRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleResumeUpload(f); }}
                  >
                    <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }} />
                    {uploading ? (
                      <div className="flex items-center gap-2 text-violet-300"><Activity size={20} className="animate-pulse" />Uploading...</div>
                    ) : resumeFile ? (
                      <div className="flex items-center gap-3">
                        <FileText size={24} className="text-violet-400" />
                        <div>
                          <p className="text-violet-300 font-medium">{resumeFile.name}</p>
                          <p className="text-xs text-slate-500">{(resumeFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={32} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                        <p className="text-slate-400">Drop resume here or click to upload</p>
                        <p className="text-xs text-slate-600">PDF, DOC, DOCX</p>
                      </div>
                    )}
                  </div>

                  {resumeFile && resumeFilename && (
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => { setResumeFile(null); setResumeFilename(""); if (resumeRef.current) resumeRef.current.value = ""; }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm hover:bg-red-500/20 transition-all">
                        <Trash2 size={14} />Remove
                      </button>
                      <button onClick={saveResume} className="btn-primary flex items-center gap-1.5">
                        <Save size={16} />Save & Continue
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 2: Email */}
          {currentStep === 2 && (
            <div className="glass-card">
              <div className="flex items-center gap-2 mb-4">
                <Mail size={20} className="text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Email Content</h2>
              </div>

              {emailSaved ? (
                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" />
                      <span className="text-emerald-300 text-sm font-medium">Email Saved</span>
                    </div>
                    <button onClick={unsaveEmail} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm hover:bg-red-500/20 transition-all">
                      <Trash2 size={14} />Edit
                    </button>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                    <p className="text-xs text-slate-500 mb-1">Subject</p>
                    <p className="text-sm text-slate-200 mb-3">{subject}</p>
                    <p className="text-xs text-slate-500 mb-1">Body</p>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans">{body}</pre>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">Same email goes to all recipients.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Subject</label>
                      <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Body</label>
                      <textarea className="input-field" rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setCurrentStep(1)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-sm">
                      <ChevronLeft size={16} />Back
                    </button>
                    <button onClick={saveEmail} className="btn-primary flex items-center gap-1.5" disabled={!subject || !body}>
                      <Save size={16} />Save & Continue
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Recipients */}
          {currentStep === 3 && (
            <div className="glass-card">
              <div className="flex items-center gap-2 mb-4">
                <Users size={20} className="text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Recipients</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">CSV Format</label>
                  <select className="input-field" value={csvFormat} onChange={(e) => setCsvFormat(e.target.value as "name,email" | "email,name")}>
                    <option value="name,email">name, email</option>
                    <option value="email,name">email, name</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Upload CSV</label>
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="input-field text-sm" />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Manual Entry</label>
                <textarea className="input-field" rows={3} placeholder={"hr@company.com\nJohn <john@company.com>"} value={manualEmails} onChange={(e) => setManualEmails(e.target.value)} />
                <button onClick={parseManualEmails} className="btn-primary text-sm mt-2 flex items-center gap-1.5">
                  <Users size={14} />Add
                </button>
              </div>

              {recipients.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="badge badge-info flex items-center gap-1"><Users size={12} />{recipients.length}</span>
                    <button onClick={() => { setRecipients([]); addLog("Cleared"); }} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                      <Trash2 size={12} />Clear
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {recipients.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-1.5 text-sm border border-slate-700/20">
                        <span>
                          {r.name && <span className="text-slate-400">{r.name} — </span>}
                          <span className="text-violet-300">{r.email}</span>
                        </span>
                        <button onClick={() => setRecipients((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setCurrentStep(2)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-sm">
                  <ChevronLeft size={16} />Back
                </button>
                <button onClick={() => setCurrentStep(4)} className="btn-primary flex items-center gap-1.5" disabled={!recipients.length}>
                  Next<ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Send */}
          {currentStep === 4 && (
            <div className="glass-card">
              <div className="flex items-center gap-2 mb-4">
                <Send size={20} className="text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Send Emails</h2>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { icon: Users, value: recipients.length, label: "Recipients", color: "text-violet-300" },
                  { icon: Paperclip, value: resumeSaved ? "Yes" : "No", label: "Resume", color: resumeSaved ? "text-emerald-300" : "text-slate-500" },
                  { icon: Clock, value: `${minDelay}-${maxDelay}s`, label: "Delay", color: "text-amber-300" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="bg-slate-800/30 rounded-xl p-3 text-center border border-slate-700/20">
                      <Icon size={16} className={`${item.color} mx-auto mb-1`} />
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Min Delay: {minDelay}s</label>
                  <input type="range" min={0} max={30} value={minDelay} onChange={(e) => setMinDelay(parseInt(e.target.value))} className="w-full accent-violet-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Max Delay: {maxDelay}s</label>
                  <input type="range" min={0} max={60} value={maxDelay} onChange={(e) => setMaxDelay(parseInt(e.target.value))} className="w-full accent-violet-500" />
                </div>
              </div>

              {sending && (
                <div className="mb-4">
                  <div className="progress-bar"><div className="progress-fill" style={{ width: "50%" }} /></div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Activity size={12} className="animate-pulse" />Sending...</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(3)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-sm">
                  <ChevronLeft size={16} />Back
                </button>
                <button onClick={handleSend} disabled={sending || !recipients.length || !smtpConfigured} className="btn-primary flex-1 text-lg py-3 flex items-center justify-center gap-2">
                  <Send size={18} />{sending ? "Sending..." : !smtpConfigured ? "Configure SMTP First" : `Send to ${recipients.length}`}
                </button>
              </div>

              {results.length > 0 && (
                <div className="mt-5 bg-slate-800/20 rounded-xl p-4 border border-slate-700/20">
                  <div className="flex gap-6 mb-3">
                    <div className="flex items-center gap-2"><Check size={18} className="text-emerald-400" /><span className="text-xl font-bold text-emerald-400">{sentCount}</span></div>
                    {failedCount > 0 && <div className="flex items-center gap-2"><X size={18} className="text-red-400" /><span className="text-xl font-bold text-red-400">{failedCount}</span></div>}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {results.map((r, i) => (
                      <div key={i} className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${r.status === "sent" ? "text-emerald-400" : "text-red-400"}`}>
                        {r.status === "sent" ? <Check size={12} /> : <X size={12} />}{r.email}{r.error && ` — ${r.error}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="glass-card sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <Eye size={18} className="text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Live Preview</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">From</span>
                <p className="text-slate-300">{smtpUser || "..."}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Subject</span>
                <p className="text-slate-200">{subject}</p>
              </div>
              <hr className="border-slate-800" />
              <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
              {resumeSaved && resumeFile && (
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                  <Paperclip size={12} className="text-violet-400" />
                  <span className="text-xs text-violet-300">{resumeFile.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Activity</h2>
            </div>
            <div className="log-container">
              {logs.length === 0 ? (
                <p className="text-slate-600 text-xs">Upload a resume to start</p>
              ) : (
                logs.map((log, i) => (
                  <p key={i} className={`text-xs ${log.includes("ERROR") ? "text-red-400" : log.includes("Sent") || log.includes("Done") ? "text-emerald-400" : "text-slate-500"}`}>
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Tour Overlay */}
      {showTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card max-w-md w-full !border-violet-500/30 relative">
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {tourSteps.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === tourStep ? "w-6 bg-violet-400" : i < tourStep ? "w-1.5 bg-violet-400/50" : "w-1.5 bg-slate-700"}`} />
              ))}
            </div>

            {/* Icon */}
            {(() => { const Icon = tourSteps[tourStep].icon; return (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                <Icon size={28} className="text-white" />
              </div>
            ); })()}

            {/* Content */}
            <h2 className="text-xl font-bold text-white text-center mb-2">{tourSteps[tourStep].title}</h2>
            <p className="text-sm text-slate-400 text-center leading-relaxed mb-8">{tourSteps[tourStep].desc}</p>

            {/* Step counter */}
            <p className="text-[10px] text-slate-600 text-center mb-4 uppercase tracking-widest">{tourStep + 1} of {tourSteps.length}</p>

            {/* Navigation */}
            <div className="flex gap-3">
              {tourStep > 0 && (
                <button onClick={() => setTourStep(tourStep - 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-sm flex-1">
                  <ChevronLeft size={16} />Back
                </button>
              )}
              {tourStep < tourSteps.length - 1 ? (
                <button onClick={() => setTourStep(tourStep + 1)} className="btn-primary flex items-center justify-center gap-1.5 flex-1">
                  Next<ChevronRight size={16} />
                </button>
              ) : (
                <button onClick={() => { setShowTour(false); localStorage.setItem("email-blaster-tour-seen", "1"); }} className="btn-primary flex items-center justify-center gap-1.5 flex-1">
                  <Zap size={16} />Get Started
                </button>
              )}
            </div>

            {/* Skip */}
            {tourStep < tourSteps.length - 1 && (
              <button onClick={() => { setShowTour(false); localStorage.setItem("email-blaster-tour-seen", "1"); }} className="text-xs text-slate-600 hover:text-slate-400 mt-4 block mx-auto transition-colors">
                Skip tour
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
