"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Send, Shield, Key, Mail, Settings, Eye,
  ChevronDown, ChevronUp, Users, FileText, Clock,
  History, HelpCircle, CheckCircle2, AlertTriangle,
  ExternalLink, Copy, Check, Zap, Layers, Search
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

interface FaqItem { q: string; a: string; }

const faqs: FaqItem[] = [
  { q: "Is my password stored securely?", a: "Your app password is stored in your browser's localStorage only. It never gets saved on any server. When you clear browser data or click Remove in settings, it's gone permanently." },
  { q: "Why do I need an App Password instead of my regular password?", a: "Google blocks regular passwords for third-party apps. App Passwords are 16-character codes that give limited access to your account — they can only send emails, not change your password or access sensitive settings." },
  { q: "Can I revoke the App Password later?", a: "Yes! Go to myaccount.google.com/apppasswords anytime and delete the password. It immediately stops working. You can create a new one whenever needed." },
  { q: "Will my emails go to spam?", a: "To reduce spam risk: use reasonable delays between emails (3-10 seconds), don't send to too many recipients at once (keep batches under 50), personalize your subject line, and avoid spam trigger words like 'FREE' or 'BUY NOW'." },
  { q: "Is there a sending limit?", a: "Gmail allows ~500 emails/day for personal accounts and ~2000/day for Google Workspace. If you hit the limit, wait 24 hours. The delay setting helps space out sends to avoid triggering rate limits." },
  { q: "Does this work with non-Gmail providers?", a: "Yes! Change the SMTP Host and Port in settings. Common examples: Outlook (smtp.office365.com:587), Yahoo (smtp.mail.yahoo.com:465 with SSL), or any custom SMTP server." },
  { q: "What happens if I close the browser while sending?", a: "Sending happens on the server — once you hit Send, the server processes all emails even if you close the tab. But you won't see the results until you check the History page." },
  { q: "Can I attach files other than a resume?", a: "Currently the app supports one attachment (PDF, DOC, DOCX). It's designed for job applications with resume attachments, but any document in those formats works." },
];

export default function GuidePage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>("gmail");

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
            { step: "1", title: "Get App Password", desc: "Generate from your email provider", icon: Key, color: "text-amber-400" },
            { step: "2", title: "Configure Settings", desc: "Enter credentials in the app", icon: Settings, color: "text-violet-400" },
            { step: "3", title: "Start Sending", desc: "Compose, add recipients, send", icon: Send, color: "text-emerald-400" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/20">
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

      {/* Gmail App Password Steps */}
      <div className="glass-card mb-6">
        <button
          onClick={() => setExpandedProvider(expandedProvider === "gmail" ? null : "gmail")}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Mail size={20} className="text-red-400" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-white">Gmail App Password</h2>
              <p className="text-xs text-slate-500">Step-by-step instructions</p>
            </div>
          </div>
          {expandedProvider === "gmail" ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
        </button>

        {expandedProvider === "gmail" && (
          <div className="mt-6 space-y-4">
            {/* Prerequisite */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-300">Prerequisite: Enable 2-Step Verification</p>
                  <p className="text-xs text-slate-400 mt-1">App Passwords only work if 2-Step Verification is turned on. If you haven't enabled it yet, do that first.</p>
                </div>
              </div>
            </div>

            {/* Steps */}
            {[
              {
                num: 1,
                title: "Enable 2-Step Verification (if not already)",
                steps: [
                  "Go to your Google Account: myaccount.google.com",
                  "Click \"Security\" in the left sidebar",
                  "Under \"How you sign in to Google\", click \"2-Step Verification\"",
                  "Follow the prompts to enable it (you'll need your phone)",
                ],
                link: "https://myaccount.google.com/security",
                linkText: "Open Google Security Settings",
              },
              {
                num: 2,
                title: "Go to App Passwords page",
                steps: [
                  "Visit the App Passwords page directly (link below)",
                  "Or: Google Account → Security → 2-Step Verification → App passwords (at the bottom)",
                  "You may need to sign in again to verify your identity",
                ],
                link: "https://myaccount.google.com/apppasswords",
                linkText: "Open App Passwords Page",
              },
              {
                num: 3,
                title: "Create a new App Password",
                steps: [
                  "In the \"App name\" field, type: Email Blaster (or any name you prefer)",
                  "Click \"Create\" button",
                  "Google will show you a 16-character password like: abcd efgh ijkl mnop",
                ],
              },
              {
                num: 4,
                title: "Copy the password",
                steps: [
                  "Copy the 16-character password immediately — Google only shows it once!",
                  "Remove the spaces when pasting (or keep them, both work)",
                  "Example format: abcdefghijklmnop",
                  "Click \"Done\" after copying",
                ],
              },
              {
                num: 5,
                title: "Enter in Email Blaster Pro",
                steps: [
                  "Go back to Email Blaster Pro",
                  "Click the gear icon (⚙) in the top-right to open Settings",
                  "Enter your Gmail address in \"Email Address\"",
                  "Paste the 16-character App Password in \"App Password\"",
                  "Leave Host as smtp.gmail.com, Port as 587, Security as STARTTLS",
                  "Click \"Test Connection\" to verify — should show green success",
                  "Click \"Save Config\" to save permanently",
                ],
              },
            ].map((step) => (
              <div key={step.num} className="relative pl-10">
                <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-violet-300">{step.num}</span>
                </div>
                {step.num < 5 && <div className="absolute left-3.5 top-7 w-px h-[calc(100%)] bg-slate-700/50" />}

                <div className="pb-4">
                  <h3 className="text-sm font-semibold text-white mb-2">{step.title}</h3>
                  <ul className="space-y-1.5">
                    {step.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <CheckCircle2 size={12} className="text-violet-400/50 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                  {step.link && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20 text-xs hover:bg-violet-500/20 transition-all">
                      <ExternalLink size={12} />{step.linkText}
                    </a>
                  )}
                </div>
              </div>
            ))}

            {/* Visual example */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Example Settings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                  <span className="text-slate-500">Email Address</span>
                  <div className="flex items-center gap-2">
                    <span className="text-violet-300">you@gmail.com</span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                  <span className="text-slate-500">App Password</span>
                  <div className="flex items-center gap-2">
                    <span className="text-violet-300 font-mono">abcdefghijklmnop</span>
                    <CopyButton text="abcdefghijklmnop" />
                  </div>
                </div>
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                  <span className="text-slate-500">SMTP Host</span>
                  <span className="text-slate-300">smtp.gmail.com</span>
                </div>
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                  <span className="text-slate-500">Port / Security</span>
                  <span className="text-slate-300">587 / STARTTLS</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outlook */}
      <div className="glass-card mb-6">
        <button
          onClick={() => setExpandedProvider(expandedProvider === "outlook" ? null : "outlook")}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Mail size={20} className="text-blue-400" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-white">Outlook / Hotmail</h2>
              <p className="text-xs text-slate-500">Microsoft account setup</p>
            </div>
          </div>
          {expandedProvider === "outlook" ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
        </button>

        {expandedProvider === "outlook" && (
          <div className="mt-6 space-y-3">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30 space-y-3">
              {[
                "Go to account.microsoft.com/security",
                "Enable 2-Step Verification if not already on",
                "Go to \"Advanced security options\"",
                "Under \"App passwords\", click \"Create a new app password\"",
                "Copy the generated password",
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Settings</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Host: </span><span className="text-slate-300">smtp.office365.com</span></div>
                <div><span className="text-slate-500">Port: </span><span className="text-slate-300">587</span></div>
                <div><span className="text-slate-500">Security: </span><span className="text-slate-300">STARTTLS</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Yahoo */}
      <div className="glass-card mb-6">
        <button
          onClick={() => setExpandedProvider(expandedProvider === "yahoo" ? null : "yahoo")}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Mail size={20} className="text-purple-400" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-white">Yahoo Mail</h2>
              <p className="text-xs text-slate-500">Yahoo account setup</p>
            </div>
          </div>
          {expandedProvider === "yahoo" ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
        </button>

        {expandedProvider === "yahoo" && (
          <div className="mt-6 space-y-3">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30 space-y-3">
              {[
                "Go to login.yahoo.com → Account Security",
                "Enable 2-Step Verification",
                "Click \"Generate app password\"",
                "Select \"Other App\", name it \"Email Blaster\"",
                "Copy the generated password",
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Settings</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Host: </span><span className="text-slate-300">smtp.mail.yahoo.com</span></div>
                <div><span className="text-slate-500">Port: </span><span className="text-slate-300">465</span></div>
                <div><span className="text-slate-500">Security: </span><span className="text-slate-300">SSL/TLS</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* How to Use the App */}
      <div className="glass-card mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Layers size={20} className="text-violet-400" />
          <h2 className="text-lg font-semibold text-white">How to Use Email Blaster Pro</h2>
        </div>

        <div className="space-y-6">
          {[
            {
              icon: Settings, color: "text-amber-400", bg: "bg-amber-500/10",
              title: "Step 1: Configure SMTP",
              desc: "Click the gear icon in the header. Enter your email and App Password. Hit \"Test Connection\" first to verify, then \"Save Config\" to save. The gear turns green when connected.",
            },
            {
              icon: FileText, color: "text-violet-400", bg: "bg-violet-500/10",
              title: "Step 2: Upload Resume (Optional)",
              desc: "Drag & drop or click to upload your resume (PDF, DOC, DOCX). It gets attached to every email. Saved in your browser — persists between sessions. Skip this step if you don't need an attachment.",
            },
            {
              icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10",
              title: "Step 3: Compose Email",
              desc: "Write your email subject and body. This same content goes to all recipients. Use the Live Preview on the right to see exactly how your email looks. Click \"Save & Continue\" when done.",
            },
            {
              icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10",
              title: "Step 4: Add Recipients",
              desc: "Add emails manually (one per line, supports \"Name <email>\" format) or upload a CSV file. You can mix both methods. Remove individual recipients with the X button, or clear all.",
            },
            {
              icon: Send, color: "text-red-400", bg: "bg-red-500/10",
              title: "Step 5: Review & Send",
              desc: "Check the summary: recipients count, attachment status, delay settings. Adjust min/max delay between sends (recommended: 3-10 seconds to avoid spam filters). Hit Send and watch real-time progress in the Activity log.",
            },
            {
              icon: History, color: "text-cyan-400", bg: "bg-cyan-500/10",
              title: "Step 6: Check History",
              desc: "Click the clock icon in the header to view all past sends. Switch between \"Batches\" view (grouped by send session) and \"By Email\" view (grouped by recipient). Search, filter by status, sort by any column.",
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                  <Icon size={20} className={item.color} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { tip: "Use 3-10 second delays", desc: "Prevents spam filters from flagging you" },
            { tip: "Keep batches under 50", desc: "Split large lists into multiple sends" },
            { tip: "Test with yourself first", desc: "Send to your own email before bulk sending" },
            { tip: "Check History after sending", desc: "Verify delivery status for each recipient" },
            { tip: "Use CSV for large lists", desc: "Format: name,email (one per row, with header)" },
            { tip: "Install as PWA", desc: "Click Install in header for desktop app experience" },
          ].map((t, i) => (
            <div key={i} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/20">
              <p className="text-xs font-semibold text-violet-300">{t.tip}</p>
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
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm text-slate-200 pr-4">{faq.q}</span>
                {expandedFaq === i ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
              </button>
              {expandedFaq === i && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-slate-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-8">
        <Link href="/" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-3">
          <Send size={20} />Start Sending Emails
        </Link>
      </div>
    </div>
  );
}
