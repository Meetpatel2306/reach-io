"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Send, Key, Mail, Settings,
  ChevronDown, ChevronUp, Users, FileText,
  History, HelpCircle, CheckCircle2, AlertTriangle,
  ExternalLink, Copy, Check, Zap, Layers,
  Smartphone, Share, Plus, Download, Apple, MoreVertical, Monitor
} from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-xs text-slate-400 hover:text-violet-300 border border-slate-700/50 transition-all">
      {copied ? <><Check size={11} className="text-emerald-400" />Copied</> : <><Copy size={11} />Copy</>}
    </button>
  );
}

const faqs = [
  { q: "Is my password stored securely?", a: "Your app password is stored in your browser's localStorage only. It never gets saved on any server. When you clear browser data or click Remove in settings, it's gone permanently." },
  { q: "Why do I need an App Password instead of my regular password?", a: "Google blocks regular passwords for third-party apps. App Passwords are 16-character codes that give limited access to your account — they can only send emails, not change your password or access sensitive settings." },
  { q: "Can I revoke the App Password later?", a: "Yes! Go to myaccount.google.com/apppasswords anytime and delete the password. It immediately stops working. You can create a new one whenever needed." },
  { q: "Will my emails go to spam?", a: "To reduce spam risk: use reasonable delays between emails (3-10 seconds), don't send to too many recipients at once (keep batches under 50), personalize your subject line, and avoid spam trigger words like 'FREE' or 'BUY NOW'." },
  { q: "Is there a sending limit?", a: "Gmail allows ~500 emails/day for personal accounts and ~2000/day for Google Workspace. If you hit the limit, wait 24 hours. The delay setting helps space out sends to avoid triggering rate limits." },
  { q: "Does this work with non-Gmail providers?", a: "Yes! Change the SMTP Host and Port in settings. See the provider cards below for Outlook, Yahoo, and custom SMTP servers." },
  { q: "What happens if I close the browser while sending?", a: "Sending happens on the server — once you hit Send, the server processes all emails even if you close the tab. But you won't see the results until you check the History page." },
  { q: "Can I attach files other than a resume?", a: "Currently the app supports one attachment (PDF, DOC, DOCX). It's designed for job applications with resume attachments, but any document in those formats works." },
];

export default function GuidePage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [activeProvider, setActiveProvider] = useState("gmail");

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Setup Guide</h1>
          <p className="text-slate-500 text-xs">How to get your App Password and start sending</p>
        </div>
      </div>

      {/* Quick Overview */}
      <div className="glass-card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Quick Overview</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">Email Blaster Pro sends emails using your own email account via SMTP. You need an <strong className="text-violet-300">App Password</strong> (not your regular password) to connect securely.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Get App Password", desc: "Generate from your email provider", icon: Key, color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/5" },
            { step: "2", title: "Configure Settings", desc: "Enter credentials in the app", icon: Settings, color: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/5" },
            { step: "3", title: "Start Sending", desc: "Compose, add recipients, send", icon: Send, color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/5" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className={`${s.bg} rounded-xl p-4 border ${s.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold flex items-center justify-center">{s.step}</span>
                  <Icon size={16} className={s.color} />
                </div>
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email Provider Cards */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Key size={20} className="text-violet-400" />
          Choose Your Email Provider
        </h2>

        {/* Provider selector cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { id: "gmail", name: "Gmail", color: "from-red-500 to-orange-500", border: "border-red-500/30", text: "text-red-300", bg: "bg-red-500/5" },
            { id: "outlook", name: "Outlook", color: "from-blue-500 to-cyan-500", border: "border-blue-500/30", text: "text-blue-300", bg: "bg-blue-500/5" },
            { id: "yahoo", name: "Yahoo", color: "from-purple-500 to-pink-500", border: "border-purple-500/30", text: "text-purple-300", bg: "bg-purple-500/5" },
            { id: "custom", name: "Custom SMTP", color: "from-slate-500 to-slate-400", border: "border-slate-500/30", text: "text-slate-300", bg: "bg-slate-500/5" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProvider(p.id)}
              className={`rounded-xl p-4 border text-center transition-all ${
                activeProvider === p.id
                  ? `${p.bg} ${p.border} ring-1 ring-offset-0 ring-offset-transparent ${p.border.replace("border-", "ring-")}`
                  : "bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center mx-auto mb-2`}>
                <Mail size={16} className="text-white" />
              </div>
              <p className={`text-sm font-semibold ${activeProvider === p.id ? p.text : "text-slate-400"}`}>{p.name}</p>
            </button>
          ))}
        </div>

        {/* Gmail */}
        {activeProvider === "gmail" && (
          <div className="glass-card !border-red-500/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Mail size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Gmail Setup</h3>
                <p className="text-xs text-slate-500">Get your 16-character App Password</p>
              </div>
            </div>

            {/* Prerequisite */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-5 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/80"><strong>Prerequisite:</strong> 2-Step Verification must be enabled on your Google account first.</p>
            </div>

            {/* Steps */}
            <div className="space-y-3 mb-5">
              {[
                { title: "Enable 2-Step Verification", desc: "Google Account → Security → 2-Step Verification → Enable", link: "https://myaccount.google.com/security" },
                { title: "Open App Passwords", desc: "Google Account → Security → 2-Step Verification → App passwords", link: "https://myaccount.google.com/apppasswords" },
                { title: "Create App Password", desc: "Name it \"Email Blaster\" → Click Create" },
                { title: "Copy the 16-character code", desc: "Shown only once! Example: abcd efgh ijkl mnop" },
                { title: "Paste in Email Blaster", desc: "Settings (gear icon) → Email + App Password → Test → Save" },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                        <ExternalLink size={10} />Open Link
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Settings card */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-red-500/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Gmail SMTP Settings</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Email", value: "you@gmail.com", color: "text-red-300" },
                  { label: "Password", value: "16-char app password", color: "text-amber-300" },
                  { label: "Host", value: "smtp.gmail.com", color: "text-slate-300" },
                  { label: "Port / Security", value: "587 / STARTTLS", color: "text-slate-300" },
                ].map((c, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</p>
                    <p className={`text-xs font-medium ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Outlook */}
        {activeProvider === "outlook" && (
          <div className="glass-card !border-blue-500/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Mail size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Outlook / Hotmail Setup</h3>
                <p className="text-xs text-slate-500">Microsoft account App Password</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { title: "Go to Microsoft Security", desc: "Visit account.microsoft.com/security", link: "https://account.microsoft.com/security" },
                { title: "Enable 2-Step Verification", desc: "If not already enabled" },
                { title: "Advanced Security Options", desc: "Click \"Advanced security options\"" },
                { title: "Create App Password", desc: "Under \"App passwords\" → Create new" },
                { title: "Copy & Paste", desc: "Copy password → Paste in Email Blaster Settings" },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                    {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-violet-400 hover:text-violet-300"><ExternalLink size={10} />Open Link</a>}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-blue-500/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Outlook SMTP Settings</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Host", value: "smtp.office365.com", color: "text-blue-300" },
                  { label: "Port", value: "587", color: "text-slate-300" },
                  { label: "Security", value: "STARTTLS", color: "text-slate-300" },
                  { label: "Email", value: "you@outlook.com", color: "text-blue-300" },
                ].map((c, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</p>
                    <p className={`text-xs font-medium ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Yahoo */}
        {activeProvider === "yahoo" && (
          <div className="glass-card !border-purple-500/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Mail size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Yahoo Mail Setup</h3>
                <p className="text-xs text-slate-500">Yahoo App Password</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { title: "Open Account Security", desc: "Go to login.yahoo.com → Account Security" },
                { title: "Enable 2-Step Verification", desc: "Turn on if not already enabled" },
                { title: "Generate App Password", desc: "Click \"Generate app password\"" },
                { title: "Name It", desc: "Select \"Other App\", name it \"Email Blaster\"" },
                { title: "Copy & Paste", desc: "Copy password → Paste in Email Blaster Settings" },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-purple-500/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Yahoo SMTP Settings</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Host", value: "smtp.mail.yahoo.com", color: "text-purple-300" },
                  { label: "Port", value: "465", color: "text-slate-300" },
                  { label: "Security", value: "SSL/TLS", color: "text-slate-300" },
                  { label: "Email", value: "you@yahoo.com", color: "text-purple-300" },
                ].map((c, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</p>
                    <p className={`text-xs font-medium ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Custom SMTP */}
        {activeProvider === "custom" && (
          <div className="glass-card !border-slate-500/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-400 flex items-center justify-center">
                <Settings size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Custom SMTP Server</h3>
                <p className="text-xs text-slate-500">Any email provider with SMTP access</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-4">If your email provider isn't listed above, you can use any SMTP server. Contact your provider or check their documentation for these details:</p>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30 mb-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Required Settings</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "SMTP Host", value: "mail.yourprovider.com", color: "text-slate-300" },
                  { label: "Port", value: "587 or 465", color: "text-slate-300" },
                  { label: "Security", value: "STARTTLS (587) or SSL (465)", color: "text-slate-300" },
                  { label: "Auth", value: "Your email + password", color: "text-slate-300" },
                ].map((c, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.label}</p>
                    <p className={`text-xs font-medium ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/80">Some providers require an App Password even with custom SMTP. Check your provider's documentation for "third-party app access" or "SMTP authentication".</p>
            </div>
          </div>
        )}
      </div>

      {/* How to Use */}
      <div className="glass-card mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Layers size={20} className="text-violet-400" />
          <h2 className="text-lg font-semibold text-white">How to Use Email Blaster Pro</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Settings, color: "text-amber-400", gradient: "from-amber-500 to-orange-500", title: "Configure SMTP", desc: "Gear icon → Enter email + App Password → Test → Save" },
            { icon: FileText, color: "text-violet-400", gradient: "from-violet-500 to-indigo-500", title: "Upload Resume", desc: "Drag & drop PDF/DOC. Auto-attaches to every email." },
            { icon: Mail, color: "text-blue-400", gradient: "from-blue-500 to-cyan-500", title: "Compose Email", desc: "Write subject + body. Live Preview shows the result." },
            { icon: Users, color: "text-emerald-400", gradient: "from-emerald-500 to-teal-500", title: "Add Recipients", desc: "Manual entry, Name <email> format, or CSV upload." },
            { icon: Send, color: "text-red-400", gradient: "from-red-500 to-pink-500", title: "Review & Send", desc: "Set delay (3-10s), hit Send, watch Activity log." },
            { icon: History, color: "text-cyan-400", gradient: "from-cyan-500 to-blue-500", title: "Check History", desc: "Clock icon → Batches or By Email → Search & filter." },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/20 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pro Tips */}
      <div className="glass-card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Pro Tips</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { tip: "Use 3-10s delays", desc: "Avoids spam filters", color: "text-emerald-300", border: "border-emerald-500/15", bg: "bg-emerald-500/5" },
            { tip: "Batches under 50", desc: "Split large lists", color: "text-blue-300", border: "border-blue-500/15", bg: "bg-blue-500/5" },
            { tip: "Test yourself first", desc: "Send to your own email", color: "text-amber-300", border: "border-amber-500/15", bg: "bg-amber-500/5" },
            { tip: "Check History", desc: "Verify delivery status", color: "text-violet-300", border: "border-violet-500/15", bg: "bg-violet-500/5" },
            { tip: "CSV for bulk", desc: "name,email format", color: "text-cyan-300", border: "border-cyan-500/15", bg: "bg-cyan-500/5" },
            { tip: "Install as PWA", desc: "Desktop app experience", color: "text-pink-300", border: "border-pink-500/15", bg: "bg-pink-500/5" },
          ].map((t, i) => (
            <div key={i} className={`${t.bg} rounded-xl p-3 border ${t.border}`}>
              <p className={`text-xs font-semibold ${t.color}`}>{t.tip}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="glass-card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={20} className="text-violet-400" />
          <h2 className="text-lg font-semibold text-white">FAQ</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-700/30 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors">
                <span className="text-sm text-slate-200 pr-4">{faq.q}</span>
                {expandedFaq === i ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
              </button>
              {expandedFaq === i && <div className="px-3 pb-3"><p className="text-xs text-slate-400 leading-relaxed">{faq.a}</p></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="text-center py-8">
        <Link href="/" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-3">
          <Send size={20} />Start Sending Emails
        </Link>
      </div>
    </div>
  );
}
