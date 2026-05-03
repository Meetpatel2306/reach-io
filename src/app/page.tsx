"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText, Upload, Mail, Send, Users, Check, X, Trash2,
  Save, ChevronRight, ChevronLeft, Download, Activity,
  Clock, Paperclip, Eye, EyeOff, Settings, Loader2, History,
  Zap, HelpCircle, Shield, Key, BookOpen, Share, Plus, Smartphone,
  RefreshCw, Sparkles, LogOut, Crown, User as UserIcon
} from "lucide-react";
import Link from "next/link";
import { saveToHistory } from "@/lib/history";
import type { EmailResult } from "@/lib/history";
import { setupAutoUpdateCheck, applyUpdate, checkForUpdate, getAutoUpdate, setAutoUpdate, BUNDLED_VERSION } from "@/lib/updater";
import { loadOAuth, clearOAuth, consumeOAuthFragment, startOAuth, getValidAccessToken, type OAuthSession } from "@/lib/oauth";
import { syncCurrentUser, clearUserData } from "@/lib/session-storage";
import { TemplatePicker } from "@/components/jobs/TemplatePicker";
import { ResumesPicker } from "@/components/jobs/ResumesPicker";
import { SavedSlotsBar } from "@/components/jobs/SavedSlotsBar";
import { SendStepCombo } from "@/components/jobs/SendStepCombo";

interface Recipient {
  name: string;
  email: string;
  // Optional fields used for {company}/{role} placeholder rendering when sending
  // (filled when recipients come from saved Contacts).
  company?: string;
  role?: string;
  custom1?: string;
  custom2?: string;
}
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
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Update detection
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>("");
  const [updateNotes, setUpdateNotes] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [autoUpdating, setAutoUpdating] = useState(false);

  // Google OAuth session
  const [oauthSession, setOauthSession] = useState<OAuthSession | null>(null);

  // App auth session (login/register)
  const [authUser, setAuthUser] = useState<{ email: string; name: string; role: "admin" | "user" } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Delete-account modal state
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [authReady, setAuthReady] = useState(false);

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

  // Load SMTP config: ONLY from localStorage. Wait for authReady so it's scoped to current user.
  useEffect(() => {
    if (!authReady) return;
    const saved = loadSmtp();
    if (saved && saved.smtpUser && saved.smtpPass) {
      setSmtpUser(saved.smtpUser.trim());
      setSmtpHost(saved.smtpHost?.trim() || "smtp.gmail.com");
      setSmtpPort(saved.smtpPort?.trim() || "587");
      setSmtpPass(saved.smtpPass.trim());
      setSmtpSecurity(saved.smtpSecurity?.trim() || "starttls");
      setSmtpConfigured(true);
    }
  }, [authReady]);

  // OAuth error from URL (?oauth_error=...)
  const [oauthError, setOauthError] = useState<string>("");

  // Google OAuth: consume callback fragment + load saved session + handle errors
  // Wait for authReady so localStorage has been scoped to the current user first
  useEffect(() => {
    if (!authReady) return;
    const fromFragment = consumeOAuthFragment();
    if (fromFragment) {
      setOauthSession(fromFragment);
      setSmtpMsg(`Signed in as ${fromFragment.email}`);
      setSmtpConfigured(true);
    } else {
      const saved = loadOAuth();
      if (saved) {
        setOauthSession(saved);
        setSmtpConfigured(true);
      }
    }

    const params = new URLSearchParams(window.location.search);
    const err = params.get("oauth_error");
    if (err) {
      setOauthError(err);
      setShowSettings(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth_error");
      history.replaceState(null, "", url.toString());
    }
  }, [authReady]);

  // Load current logged-in user + sync localStorage to this user.
  // CRITICAL: this must run BEFORE any other localStorage reads (OAuth, SMTP, history)
  // to prevent showing leftover data from a previous user on the same browser.
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((data) => {
      const userEmail = data.user?.email || null;
      syncCurrentUser(userEmail);
      if (data.user) setAuthUser(data.user);
    }).catch(() => {}).finally(() => setAuthReady(true));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Clear ALL per-user data so the next login on this browser starts clean
    clearUserData();
    window.location.href = "/login";
  };

  const handleSignOut = () => {
    clearOAuth();
    setOauthSession(null);
    if (!smtpUser || !smtpPass) setSmtpConfigured(false);
    setSmtpMsg("Signed out from Google");
  };

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detection
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) setIsInstalled(true);
    if (iOS && !isStandalone) {
      setIsIOS(true);
      // Show iOS install banner if not dismissed
      if (!localStorage.getItem("email-blaster-ios-dismissed")) {
        setShowIOSInstall(true);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Load auto-update preference
  useEffect(() => {
    setAutoUpdateEnabled(getAutoUpdate());
  }, []);

  // Auto update detection — works on iOS PWA + Android + Desktop
  // Silently updates when user reopens app (visibility change) — your data is preserved
  useEffect(() => {
    const cleanup = setupAutoUpdateCheck({
      onUpdateAvailable: (info) => {
        setUpdateAvailable(true);
        setUpdateVersion(info.version);
        setUpdateNotes(info.notes || "");
      },
      onAutoUpdating: (info) => {
        setAutoUpdating(true);
        setUpdateVersion(info.version);
      },
    });
    return cleanup;
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    await applyUpdate();
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const { hasUpdate, latest } = await checkForUpdate();
    if (hasUpdate && latest) {
      setUpdateAvailable(true);
      setUpdateVersion(latest.version);
      setUpdateNotes(latest.notes || "");
    } else {
      setSmtpMsg("You're on the latest version!");
      setTimeout(() => setSmtpMsg(""), 3000);
    }
    setCheckingUpdate(false);
  };

  const toggleAutoUpdate = () => {
    const newVal = !autoUpdateEnabled;
    setAutoUpdateEnabled(newVal);
    setAutoUpdate(newVal);
  };

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

  // Tour steps — type "steps" shows numbered boxes, type "cards" shows card grid, type "default" is normal
  type TourType = "default" | "steps" | "cards";
  interface TourStep {
    title: string;
    desc: string;
    icon: typeof Send;
    tip: string | null;
    type: TourType;
    target?: string; // data-tour attribute to spotlight
    steps?: string[];
    cards?: { label: string; value: string; color: string }[];
  }
  const tourSteps: TourStep[] = [
    {
      title: "Welcome to Reach.io!",
      desc: "Send bulk emails with resume attachments — perfect for job applications. Let's walk through everything.",
      icon: Send, tip: null, type: "default",
    },
    {
      title: "Setup Guide",
      desc: "This book icon opens the full Setup Guide — step-by-step instructions for Gmail, Outlook, Yahoo, and custom SMTP.",
      icon: BookOpen, tip: "Start here if you need an App Password.", type: "default", target: "guide",
    },
    {
      title: "SMTP Settings",
      desc: "This gear icon opens your email configuration. Enter your credentials and test the connection.",
      icon: Settings, target: "settings",
      tip: "Turns green when connected. Amber when not configured yet.",
      type: "cards",
      cards: [
        { label: "Email", value: "you@gmail.com", color: "text-violet-300" },
        { label: "Password", value: "16-char app password", color: "text-amber-300" },
        { label: "Test", value: "Verify without saving", color: "text-blue-300" },
        { label: "Save", value: "Verify + save to browser", color: "text-emerald-300" },
      ],
    },
    {
      title: "Navigation Steps",
      desc: "These 4 steps guide you through the workflow. Click any step to jump directly to it.",
      icon: ChevronRight, target: "steps",
      tip: "Steps turn green when completed. You can go back and forth freely.",
      type: "default",
    },
    {
      title: "Live Preview",
      desc: "See exactly how your email will look — subject, body, sender, and attachment — updated in real time as you type.",
      icon: Eye, target: "preview",
      tip: "Shows your From address, subject, body text, and attachment name.",
      type: "default",
    },
    {
      title: "Activity Log",
      desc: "Real-time log of everything happening — uploads, saves, sends, errors. Watch each email being sent live.",
      icon: Activity, target: "activity",
      tip: "Green = success, Red = error. Timestamps included.",
      type: "default",
    },
    {
      title: "Send History",
      desc: "Clock icon opens the History page with powerful tracking.",
      icon: History, target: "history",
      tip: "\"By Email\" view shows how many times you contacted each person.",
      type: "cards",
      cards: [
        { label: "Batches", value: "Grouped by send session", color: "text-violet-300" },
        { label: "By Email", value: "Grouped by recipient", color: "text-blue-300" },
        { label: "Search", value: "Subject, email, name", color: "text-emerald-300" },
        { label: "Filter", value: "Success / Failed / All", color: "text-amber-300" },
      ],
    },
    {
      title: "Replay Tour",
      desc: "Click this ? icon anytime to replay this tour and refresh your memory on all features.",
      icon: HelpCircle, target: "tour-btn",
      tip: null, type: "default",
    },
    {
      title: "You're Ready!",
      desc: "Click the gear icon to configure your SMTP credentials and start sending. Need help? The book icon has the full guide.",
      icon: Zap, tip: null, type: "default",
    },
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
      let skipped = 0;
      const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
        let candidate: Recipient | null = null;
        if (cols.length >= 2) {
          if (csvFormat === "name,email") candidate = { name: cols[0], email: cols[1] };
          else candidate = { name: cols[1], email: cols[0] };
        } else if (cols.length === 1 && cols[0].includes("@")) {
          candidate = { name: "", email: cols[0] };
        }
        if (candidate && isValidEmail(candidate.email)) parsed.push(candidate);
        else if (candidate) skipped++;
      }
      setRecipients((prev) => [...prev, ...parsed]);
      addLog(`${parsed.length} recipients from CSV${skipped ? ` (${skipped} skipped — invalid emails)` : ""}`);
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

    // Prefer OAuth (Gmail API) when available — falls back to SMTP otherwise
    const oauth = loadOAuth();
    const smtp = loadSmtp();
    if (oauth) {
      const accessToken = await getValidAccessToken();
      if (accessToken) {
        fd.append("oauthAccessToken", accessToken);
        fd.append("oauthEmail", oauth.email);
      }
    } else if (smtp && smtp.smtpUser && smtp.smtpPass) {
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
          // Use server's batchId so user-side delete can sync to server
          id: data.batchId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          subject,
          body,
          from: oauth?.email || smtp?.smtpUser || smtpUser || "",
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
            <h1 className="text-2xl font-bold text-white">Reach.io</h1>
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
            href="/guide"
            data-tour="guide"
            className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all"
            title="Setup Guide"
          >
            <BookOpen size={18} />
          </Link>
          <Link
            href="/history"
            data-tour="history"
            className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all"
            title="Send History"
          >
            <History size={18} />
          </Link>
          <button
            onClick={() => setShowSettings(!showSettings)}
            data-tour="settings"
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
            data-tour="tour-btn"
            className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all"
            title="Product Tour"
          >
            <HelpCircle size={18} />
          </button>

          {/* User menu */}
          {authUser && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border transition-all ${
                  authUser.role === "admin"
                    ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                    : "bg-slate-800/50 border-slate-700/50 hover:border-violet-500/30"
                }`}
                title={authUser.email}
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold ${
                  authUser.role === "admin"
                    ? "bg-gradient-to-br from-amber-500 to-orange-500"
                    : "bg-gradient-to-br from-violet-500 to-indigo-500"
                }`}>
                  {(authUser.name || authUser.email).charAt(0).toUpperCase()}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${authUser.role === "admin" ? "text-amber-300" : "text-slate-300"}`}>
                  {authUser.name || authUser.email.split("@")[0]}
                </span>
                {authUser.role === "admin" && <Crown size={11} className="text-amber-400" />}
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 glass-card !p-2 z-50 !border-violet-500/30">
                    <div className="px-3 py-2 border-b border-slate-700/30 mb-1">
                      <p className="text-xs font-bold text-white truncate">{authUser.name || "User"}</p>
                      <p className="text-[10px] text-slate-400 truncate">{authUser.email}</p>
                    </div>
                    {authUser.role === "admin" && (
                      <Link href="/admin" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-amber-300 hover:bg-amber-500/10">
                        <Crown size={12} />Admin Dashboard
                      </Link>
                    )}
                    <Link href="/history" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-violet-500/10">
                      <History size={12} />Send History
                    </Link>
                    <Link href="/support" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-violet-500/10">
                      <HelpCircle size={12} />Help & Support
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10">
                      <LogOut size={12} />Sign Out
                    </button>
                    {authUser.email !== "meetpatel4384@gmail.com" && (
                      <button
                        onClick={() => { setShowUserMenu(false); setShowDeleteAccount(true); setDeletePassword(""); setDeleteConfirmText(""); setDeleteError(""); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-red-500/70 hover:bg-red-500/10 hover:text-red-400 border-t border-slate-700/30 mt-1 pt-2"
                      >
                        <Trash2 size={11} />Delete My Account
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {/* Smart Install/Update button */}
          {isInstalled && updateAvailable ? (
            // Installed + update available → show Update button
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-60"
            >
              {updating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {updating ? "Updating" : "Update"}
            </button>
          ) : !isInstalled && installPrompt ? (
            // Not installed (Android/Desktop) → show Install button
            <button onClick={handleInstall} className="btn-primary text-sm flex items-center gap-1.5"><Download size={14} />Install</button>
          ) : !isInstalled && isIOS && !showIOSInstall ? (
            // Not installed (iOS) → show Install button (opens iOS banner)
            <button onClick={() => setShowIOSInstall(true)} className="btn-primary text-sm flex items-center gap-1.5"><Smartphone size={14} />Install</button>
          ) : null}
        </div>
      </div>

      {/* Update Available Banner — works on iOS PWA + Android + Desktop */}
      {updateAvailable && !autoUpdating && (
        <div className="mb-6 relative overflow-hidden rounded-2xl border border-emerald-500/30">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent animate-pulse" />

          <div className="relative p-4">
            <div className="flex items-center gap-4 flex-wrap mb-2">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                <Sparkles size={22} className="text-white" />
              </div>

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">New Version Available!</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">{updateVersion}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {updateNotes || "Tap update to get the latest features and fixes."}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setUpdateAvailable(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/50 text-xs hover:text-slate-200 transition-all"
                >
                  Later
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-60"
                >
                  {updating ? <><Loader2 size={14} className="animate-spin" />Updating...</> : <><RefreshCw size={14} />Update Now</>}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-emerald-300/80 mt-2 ml-[60px]">
              <Shield size={10} />
              <span>Your SMTP credentials, send history, and drafts are preserved.</span>
            </div>
          </div>
        </div>
      )}

      {/* Silent auto-updating overlay */}
      {autoUpdating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}>
          <div className="glass-card max-w-sm w-full !border-emerald-500/30 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
              <Loader2 size={32} className="text-white animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Updating to {updateVersion}</h2>
            <p className="text-sm text-slate-400 mb-3">Installing the latest version automatically...</p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
              <Shield size={12} />
              <span>Your data is safe — nothing will be lost.</span>
            </div>
          </div>
        </div>
      )}

      {/* PWA Banner (Chrome / Edge / Android) */}
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

      {/* iOS Install Banner */}
      {isIOS && !isInstalled && showIOSInstall && (
        <div className="glass-card mb-6 !border-violet-500/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-purple-500/10 pointer-events-none" />
          <button
            onClick={() => { setShowIOSInstall(false); localStorage.setItem("email-blaster-ios-dismissed", "1"); }}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 z-10"
          >
            <X size={16} />
          </button>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Smartphone size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Install on iPhone</h3>
                <p className="text-[11px] text-slate-400">Add to Home Screen for full app experience</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              {[
                { num: 1, icon: Share, text: "Tap the Share button", desc: "in Safari toolbar (bottom)" },
                { num: 2, icon: Plus, text: "Scroll down & tap", desc: "\"Add to Home Screen\"" },
                { num: 3, icon: Check, text: "Tap \"Add\"", desc: "in the top-right corner" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.num} className="bg-slate-800/40 rounded-lg p-3 border border-violet-500/15">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center">{s.num}</span>
                      <Icon size={14} className="text-violet-400" />
                    </div>
                    <p className="text-xs font-semibold text-white">{s.text}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.desc}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Zap size={10} className="text-amber-400" />
              Works offline, sends notifications, and feels like a native app.
            </p>
          </div>
        </div>
      )}

      {/* SMTP Settings Panel */}
      {showSettings && (
        <div className="glass-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings size={20} className="text-violet-400" />
              <h2 className="text-lg font-semibold text-white">Email Settings</h2>
              {smtpConfigured && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Connected</span>
              )}
            </div>
            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
          </div>

          {/* OAuth error banner */}
          {oauthError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-2">
                <X size={18} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Google Sign-In Failed</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {oauthError === "not_configured" && "Google OAuth is not set up on the server. The admin needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Vercel environment variables."}
                    {oauthError === "missing_code" && "Sign-in flow was incomplete. Please try again."}
                    {oauthError === "access_denied" && "You denied permission. Please try again and allow access."}
                    {oauthError === "gmail_scope_not_granted" && "Gmail send permission was NOT granted. The admin must add the gmail.send scope in Google Cloud Console → OAuth consent screen → Scopes. After that, sign in again."}
                    {!["not_configured", "missing_code", "access_denied", "gmail_scope_not_granted"].includes(oauthError) && `Error: ${decodeURIComponent(oauthError)}`}
                  </p>
                  {oauthError === "gmail_scope_not_granted" && (
                    <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-violet-400 hover:text-violet-300 underline">
                      Open OAuth Consent Screen →
                    </a>
                  )}
                  {oauthError === "not_configured" && (
                    <p className="text-[10px] text-slate-500 mt-2">See SETUP-GOOGLE-OAUTH.md for setup instructions. App Password method below works as a fallback.</p>
                  )}
                </div>
              </div>
              <button onClick={() => setOauthError("")} className="text-xs text-slate-500 hover:text-slate-300">Dismiss</button>
            </div>
          )}

          {/* Google OAuth — primary, recommended path */}
          {oauthSession ? (
            <div className="mb-5 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <Check size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Signed in with Google</p>
                    <p className="text-xs text-emerald-300">{oauthSession.email}</p>
                  </div>
                </div>
                <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs hover:bg-red-500/20 transition-all">
                  <Trash2 size={12} />Sign Out
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-3">Emails will be sent via Gmail API (no SMTP password needed).</p>
            </div>
          ) : (
            <div className="mb-5 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Recommended: Sign in with Google</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">One-click setup. No App Password needed. Gmail-only.</p>
                </div>
              </div>
              <button
                onClick={startOAuth}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-all shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Sign in with Google
              </button>
            </div>
          )}

          {/* Divider with "or" */}
          {!oauthSession && (
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-700/40" />
              <span className="text-[10px] text-slate-600 uppercase tracking-widest">or use SMTP</span>
              <div className="flex-1 h-px bg-slate-700/40" />
            </div>
          )}

          {!oauthSession && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>}

          {smtpMsg && (
            <p className={`text-sm mt-3 ${smtpMsg.includes("successful") || smtpMsg.includes("Signed in") || smtpMsg.includes("Verified") || smtpMsg.includes("Saved") ? "text-emerald-400" : smtpMsg.includes("removed") || smtpMsg.includes("Signed out") ? "text-amber-400" : "text-red-400"}`}>{smtpMsg}</p>
          )}

          {!oauthSession && (
          <>
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
            {smtpConfigured && smtpUser && (
              <button onClick={deleteSmtpConfig} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm hover:bg-red-500/20 transition-all">
                <Trash2 size={14} />Remove
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-600 mt-3">For Gmail, use an App Password from myaccount.google.com/apppasswords</p>
          </>
          )}

          {/* App Update Section */}
          <div className="mt-5 pt-4 border-t border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400" />
                <p className="text-xs font-semibold text-slate-300">App Updates</p>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-full border border-slate-700/50">
                Running: {BUNDLED_VERSION}
              </span>
            </div>

            {/* Auto-update toggle */}
            <div className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
              <div>
                <p className="text-xs text-slate-200 font-medium">Auto-update</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Silently install updates when you reopen the app</p>
              </div>
              <button
                onClick={toggleAutoUpdate}
                className={`relative w-11 h-6 rounded-full border transition-all ${
                  autoUpdateEnabled
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 border-emerald-400/50"
                    : "bg-slate-800 border-slate-700"
                }`}
                aria-label="Toggle auto-update"
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                    autoUpdateEnabled ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Manual check + force update buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs hover:bg-cyan-500/20 transition-all"
              >
                {checkingUpdate ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {checkingUpdate ? "Checking..." : "Check Updates"}
              </button>
              <button
                onClick={async () => { if (confirm("Force update? This will clear cache and reload. Your data is preserved.")) await applyUpdate(); }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs hover:bg-amber-500/20 transition-all"
              >
                <Zap size={12} />Force Update
              </button>
            </div>
            <p className="text-[10px] text-slate-600">Auto-checks every 30s. Use Force Update if updates aren&apos;t arriving.</p>

            {/* Data safety note */}
            <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2.5">
              <Shield size={12} className="text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-emerald-300/80 leading-relaxed">
                Updates never delete your data. SMTP credentials, history, drafts, and settings are always preserved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div data-tour="steps" className="flex items-center justify-center gap-1 mb-8">
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

          {/* Saved Slots — load template + resume in one tap */}
          <SavedSlotsBar
            currentSubject={subject}
            currentBody={body}
            currentResumeFile={resumeFile}
            currentResumeFilename={resumeFilename}
            onLoad={(payload) => {
              setSubject(payload.subject);
              setBody(payload.body);
              setEmailSaved(true);
              setResumeFile(payload.resumeFile);
              setResumeFilename(payload.resumeFilename);
              setResumeSaved(true);
              // Skip ahead to recipients — both heavy steps are filled in.
              setCurrentStep(recipients.length > 0 ? 4 : 3);
              addLog(`Loaded slot: ${payload.resumeName}`);
            }}
          />

          {/* Step 1: Resume */}
          {currentStep === 1 && (
            <div className="glass-card">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={20} className="text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Resume</h2>
              </div>

              <ResumesPicker
                activeStoredFilename={resumeFilename}
                onPick={(picked) => {
                  // Reuse a previously-uploaded resume by its server-side filename.
                  // Construct a placeholder File so the existing UI shows label + size.
                  const placeholder = new File(
                    [new Blob([], { type: "application/pdf" })],
                    picked.filename,
                    { type: "application/pdf" }
                  );
                  Object.defineProperty(placeholder, "size", { value: picked.sizeBytes });
                  setResumeFile(placeholder);
                  setResumeFilename(picked.storedFilename);
                  setResumeSaved(true);
                  if (emailSaved) setCurrentStep(3); else setCurrentStep(2);
                  addLog(`Using saved resume: ${picked.label}`);
                }}
              />

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
                  <p className="text-xs text-slate-500 mb-4">Same email goes to all recipients (placeholders are personalised per-recipient).</p>
                  <TemplatePicker
                    subject={subject}
                    body={body}
                    onLoad={(s, b) => { setSubject(s); setBody(b); addLog("Template loaded"); }}
                  />
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

              <SendStepCombo
                currentSubject={subject}
                currentBody={body}
                currentResumeFile={resumeFile}
                currentResumeFilename={resumeFilename}
                onApplyTemplate={(s, b) => {
                  setSubject(s); setBody(b); setEmailSaved(true);
                  addLog("Template applied at send time");
                }}
                onApply={(payload) => {
                  setSubject(payload.subject);
                  setBody(payload.body);
                  setEmailSaved(true);
                  setResumeFile(payload.resumeFile);
                  setResumeFilename(payload.resumeFilename);
                  setResumeSaved(true);
                  addLog(`Loaded combo: ${payload.resumeName}`);
                }}
              />

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
          <div data-tour="preview" className="glass-card sticky top-4">
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

          <div data-tour="activity" className="glass-card">
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

      {/* Interactive Spotlight Tour */}
      {/* Delete Account Confirmation Modal */}
      {showDeleteAccount && authUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}>
          <div className="glass-card max-w-md w-full !border-red-500/30">
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 mb-3 shadow-lg shadow-red-500/30">
                <Trash2 size={26} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Delete your account?</h2>
              <p className="text-sm text-slate-400 mt-1">This permanently removes <span className="text-red-300 font-mono">{authUser.email}</span></p>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-slate-300 space-y-1.5 mb-5">
              <p className="font-semibold text-red-300 mb-1">This will erase:</p>
              <p>• Your account &amp; profile</p>
              <p>• All your send history (server-side records)</p>
              <p>• Your support tickets</p>
              <p>• Saved drafts &amp; settings (this device)</p>
              <p className="text-red-400/80 mt-2 font-medium">This cannot be undone.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Type <span className="font-mono text-red-300">DELETE</span> to confirm</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Confirm with your password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  className="input-field"
                />
              </div>

              {deleteError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-xs text-red-300">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowDeleteAccount(false); setDeletePassword(""); setDeleteConfirmText(""); setDeleteError(""); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting || deleteConfirmText !== "DELETE" || !deletePassword}
                  onClick={async () => {
                    setDeleteError(""); setDeleting(true);
                    try {
                      const res = await fetch("/api/auth/delete-account", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password: deletePassword }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        clearUserData();
                        window.location.href = "/register";
                      } else {
                        setDeleteError(data.error || "Failed to delete account");
                      }
                    } catch {
                      setDeleteError("Network error");
                    }
                    setDeleting(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-semibold shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {deleting ? "Deleting..." : "Delete forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTour && (() => {
        const step = tourSteps[tourStep];
        const Icon = step.icon;

        // Find target element and get its position
        const target = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
        const rect = target?.getBoundingClientRect();
        const hasTarget = !!(rect && rect.width > 0);
        const pad = 8;

        // Tooltip position
        const tooltipStyle: React.CSSProperties = hasTarget ? {
          position: "fixed",
          top: Math.min(rect!.bottom + 16, window.innerHeight - 420),
          left: Math.max(16, Math.min(rect!.left - 100, window.innerWidth - 440)),
          zIndex: 52,
        } : {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 52,
        };

        return (
        <>
          {/* Overlay with spotlight hole */}
          <div className="fixed inset-0 z-50" style={{ pointerEvents: "none" }}>
            <svg className="w-full h-full" style={{ pointerEvents: "auto" }} onClick={(e) => { if ((e.target as SVGElement).tagName === "rect") { /* clicking overlay does nothing */ } }}>
              <defs>
                <mask id="spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  {hasTarget && (
                    <rect
                      x={rect!.left - pad} y={rect!.top - pad}
                      width={rect!.width + pad * 2} height={rect!.height + pad * 2}
                      rx="12" fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.82)" mask="url(#spotlight-mask)" />
            </svg>

            {/* Highlight ring around target */}
            {hasTarget && (
              <div className="fixed z-51 pointer-events-none rounded-xl border-2 border-violet-400 shadow-lg shadow-violet-500/30" style={{
                top: rect!.top - pad, left: rect!.left - pad,
                width: rect!.width + pad * 2, height: rect!.height + pad * 2,
                animation: "pulse 2s infinite",
              }} />
            )}
          </div>

          {/* Tooltip card */}
          <div style={{ ...tooltipStyle, pointerEvents: "auto" }} className="glass-card !border-violet-500/30 w-[420px] max-w-[calc(100vw-32px)]">
            {/* Arrow pointing up to target */}
            {hasTarget && (
              <div className="absolute -top-2 left-8 w-4 h-4 rotate-45 bg-slate-900 border-l border-t border-violet-500/30" />
            )}

            {/* Progress bar */}
            <div className="h-1 bg-slate-800 rounded-full mb-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${((tourStep + 1) / tourSteps.length) * 100}%` }} />
            </div>

            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">{step.title}</h2>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest">{tourStep + 1} / {tourSteps.length}</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-3">{step.desc}</p>

            {/* Steps */}
            {step.type === "steps" && step.steps && (
              <div className="space-y-1.5 mb-3">
                {step.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/30">
                    <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{s}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Cards */}
            {step.type === "cards" && step.cards && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {step.cards.map((c, i) => (
                  <div key={i} className="bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</p>
                    <p className={`text-xs font-medium ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tip */}
            {step.tip && (
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
                <Zap size={11} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">{step.tip}</p>
              </div>
            )}

            {/* Nav */}
            <div className="flex gap-2">
              {tourStep > 0 && (
                <button onClick={() => setTourStep(tourStep - 1)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs flex-1 justify-center">
                  <ChevronLeft size={14} />Back
                </button>
              )}
              {tourStep < tourSteps.length - 1 ? (
                <button onClick={() => setTourStep(tourStep + 1)} className="btn-primary flex items-center justify-center gap-1 flex-1 !py-2 !text-sm">
                  Next<ChevronRight size={14} />
                </button>
              ) : (
                <button onClick={() => { setShowTour(false); localStorage.setItem("email-blaster-tour-seen", "1"); setShowSettings(true); }} className="btn-primary flex items-center justify-center gap-1 flex-1 !py-2 !text-sm">
                  <Zap size={14} />Configure SMTP
                </button>
              )}
            </div>

            {tourStep < tourSteps.length - 1 && (
              <button
                onClick={() => { setShowTour(false); localStorage.setItem("email-blaster-tour-seen", "1"); }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 text-sm font-semibold hover:bg-slate-800 hover:text-white transition-all"
              >
                <X size={14} />Skip Tour
              </button>
            )}
          </div>
        </>
        );
      })()}
    </div>
  );
}
