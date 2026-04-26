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

function BookIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function Sparkle() {
  return (
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30 mb-4">
      <Send size={26} className="text-white" />
    </div>
  );
}

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
  const [activePlatform, setActivePlatform] = useState("ios");

  return (
    <div className="min-h-screen max-w-4xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-indigo-500/10 to-cyan-500/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-4 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-900/60 backdrop-blur text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all">
              <ArrowLeft size={18} />
            </Link>
            <span className="text-xs text-slate-500 uppercase tracking-widest">Setup Guide</span>
          </div>

          <div className="text-center pb-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30 mb-4">
              <BookIcon />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Get Started in Minutes</h1>
            <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto">Everything you need to install Email Blaster Pro, get your App Password, and send your first email.</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 pt-2">

      {/* Sticky Table of Contents (in-page nav) */}
      <nav className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-6 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {[
            { href: "#install", label: "Install", icon: Smartphone },
            { href: "#provider", label: "Email Setup", icon: Key },
            { href: "#how-to", label: "How to Use", icon: Layers },
            { href: "#tips", label: "Pro Tips", icon: Zap },
            { href: "#faq", label: "FAQ", icon: HelpCircle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-700/30 text-xs hover:text-violet-300 hover:border-violet-500/30 transition-all whitespace-nowrap">
                <Icon size={12} />{item.label}
              </a>
            );
          })}
        </div>
      </nav>

      {/* Quick Overview — improved with gradients */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-amber-400" />
          <h2 className="text-lg font-bold text-white">3 Steps to Send Your First Email</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Get App Password", desc: "Generate from your provider", icon: Key, gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20" },
            { step: "2", title: "Configure Settings", desc: "Enter credentials in app", icon: Settings, gradient: "from-violet-500 to-indigo-500", glow: "shadow-violet-500/20" },
            { step: "3", title: "Start Sending", desc: "Compose & send emails", icon: Send, gradient: "from-emerald-500 to-cyan-500", glow: "shadow-emerald-500/20" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="group relative">
                <div className="relative bg-slate-900/60 backdrop-blur rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600/70 transition-all">
                  <div className={`absolute -top-3 -left-3 w-12 h-12 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg ${s.glow} transition-transform group-hover:scale-110`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <div className="absolute top-3 right-3 text-3xl font-black text-slate-700/50 group-hover:text-slate-600/50 transition-colors">{s.step}</div>
                  <div className="mt-7">
                    <p className="text-sm font-bold text-white">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Install App Guide */}
      <section id="install" className="mb-8 scroll-mt-20">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Smartphone size={20} className="text-violet-400" />
          Install Email Blaster Pro
        </h2>
        <p className="text-sm text-slate-400 mb-4">Install as a native app for the best experience — works offline, faster loading, and feels like a real app.</p>

        {/* Platform selector */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { id: "ios", name: "iPhone / iPad", icon: Apple, color: "from-slate-400 to-slate-200", border: "border-slate-400/40", text: "text-white", bg: "bg-slate-500/10" },
            { id: "android", name: "Android", icon: Smartphone, color: "from-emerald-500 to-green-500", border: "border-emerald-500/40", text: "text-emerald-300", bg: "bg-emerald-500/10" },
            { id: "desktop", name: "Desktop", icon: Monitor, color: "from-blue-500 to-indigo-500", border: "border-blue-500/40", text: "text-blue-300", bg: "bg-blue-500/10" },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={`rounded-xl p-4 border text-center transition-all ${
                  activePlatform === p.id
                    ? `${p.bg} ${p.border}`
                    : "bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center mx-auto mb-2`}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className={`text-sm font-semibold ${activePlatform === p.id ? p.text : "text-slate-400"}`}>{p.name}</p>
              </button>
            );
          })}
        </div>

        {/* iOS Install */}
        {activePlatform === "ios" && (
          <div className="glass-card !border-slate-400/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-400 to-slate-200 flex items-center justify-center">
                <Apple size={20} className="text-slate-900" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Install on iPhone / iPad</h3>
                <p className="text-xs text-slate-500">Use Safari — Chrome won't work for installation</p>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-5 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/80"><strong>Important:</strong> You must use Safari on iOS. Chrome and other browsers don't support PWA installation on iPhone.</p>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { num: 1, icon: Mail, title: "Open this app in Safari", desc: "If you're not in Safari, copy the URL and paste in Safari", color: "from-slate-400 to-slate-200" },
                { num: 2, icon: Share, title: "Tap the Share button", desc: "Square icon with arrow at bottom of Safari (or top on iPad)", color: "from-blue-500 to-cyan-500" },
                { num: 3, icon: Plus, title: "Scroll down & tap \"Add to Home Screen\"", desc: "You may need to scroll past the app share row", color: "from-violet-500 to-indigo-500" },
                { num: 4, icon: Check, title: "Tap \"Add\" in the top-right", desc: "App name will be \"Email Blaster\" — you can rename it here", color: "from-emerald-500 to-green-500" },
                { num: 5, icon: Smartphone, title: "Find on Home Screen", desc: "Open it like any other app — full-screen, no Safari bars", color: "from-amber-500 to-orange-500" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.num} className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
                    <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>{s.num}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className="text-violet-400" />
                        <p className="text-sm font-semibold text-white">{s.title}</p>
                      </div>
                      <p className="text-xs text-slate-400">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-400/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Why Install?</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Full Screen", value: "No Safari bars", color: "text-emerald-300" },
                  { label: "Home Screen Icon", value: "Quick access", color: "text-blue-300" },
                  { label: "Offline Support", value: "Works without internet", color: "text-violet-300" },
                  { label: "Faster Launch", value: "Instant load time", color: "text-amber-300" },
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

        {/* Android Install */}
        {activePlatform === "android" && (
          <div className="glass-card !border-emerald-500/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                <Smartphone size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Install on Android</h3>
                <p className="text-xs text-slate-500">One-tap install in Chrome, Edge, or Samsung Internet</p>
              </div>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 mb-5 flex items-start gap-3">
              <Zap size={16} className="text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-300/80"><strong>Easy mode:</strong> Look for the &quot;Install&quot; button at the top of this app — tap it for one-tap install. The instructions below are a backup if it doesn&apos;t appear.</p>
            </div>

            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Manual install (if Install button isn&apos;t showing)</p>

            <div className="space-y-3 mb-5">
              {[
                { num: 1, icon: Mail, title: "Open in Chrome (or Edge / Samsung Internet)", desc: "These browsers fully support PWA installation", color: "from-emerald-500 to-green-500" },
                { num: 2, icon: MoreVertical, title: "Tap the menu (⋮) icon", desc: "Three vertical dots, top-right corner of browser", color: "from-blue-500 to-cyan-500" },
                { num: 3, icon: Plus, title: "Tap \"Install app\" or \"Add to Home Screen\"", desc: "Different browsers use slightly different wording", color: "from-violet-500 to-indigo-500" },
                { num: 4, icon: Download, title: "Confirm installation", desc: "Tap \"Install\" in the popup that appears", color: "from-amber-500 to-orange-500" },
                { num: 5, icon: Check, title: "App appears in your app drawer", desc: "Open from home screen or app drawer like any other app", color: "from-pink-500 to-red-500" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.num} className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
                    <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>{s.num}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className="text-violet-400" />
                        <p className="text-sm font-semibold text-white">{s.title}</p>
                      </div>
                      <p className="text-xs text-slate-400">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Android Features</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "App Drawer", value: "Like Play Store apps", color: "text-emerald-300" },
                  { label: "Notifications", value: "Push support enabled", color: "text-blue-300" },
                  { label: "Shortcuts", value: "Long-press for actions", color: "text-violet-300" },
                  { label: "Offline Cache", value: "Works without WiFi", color: "text-amber-300" },
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

        {/* Desktop Install */}
        {activePlatform === "desktop" && (
          <div className="glass-card !border-blue-500/20">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Monitor size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Install on Desktop</h3>
                <p className="text-xs text-slate-500">Windows, Mac, or Linux — Chrome / Edge / Brave</p>
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 mb-5 flex items-start gap-3">
              <Zap size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-300/80"><strong>Quickest way:</strong> Look for the install icon (⊕) in the address bar — it appears automatically when the app is installable. Click it for instant install.</p>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { num: 1, icon: Mail, title: "Open in Chrome, Edge, or Brave", desc: "Safari and Firefox don't support PWA install on desktop", color: "from-blue-500 to-indigo-500" },
                { num: 2, icon: Plus, title: "Look for the install icon (⊕) in address bar", desc: "On the right side, before the bookmarks star", color: "from-cyan-500 to-blue-500" },
                { num: 3, icon: Download, title: "Or use the menu — File → Install app", desc: "Alternative: three-dot menu → Save and share → Install", color: "from-violet-500 to-blue-500" },
                { num: 4, icon: Check, title: "Click \"Install\" in the popup", desc: "App opens in its own window, no browser tabs", color: "from-emerald-500 to-cyan-500" },
                { num: 5, icon: Monitor, title: "Add shortcut to taskbar / Dock", desc: "Right-click app icon to pin for quick access", color: "from-amber-500 to-orange-500" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.num} className="flex items-start gap-3 bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
                    <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>{s.num}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className="text-violet-400" />
                        <p className="text-sm font-semibold text-white">{s.title}</p>
                      </div>
                      <p className="text-xs text-slate-400">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-blue-500/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Desktop Benefits</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Standalone Window", value: "No browser UI", color: "text-blue-300" },
                  { label: "Taskbar / Dock", value: "Pin like native app", color: "text-violet-300" },
                  { label: "Fast Switching", value: "Alt+Tab support", color: "text-emerald-300" },
                  { label: "Auto-Updates", value: "Background updates", color: "text-amber-300" },
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

        {/* After install info card */}
        <div className="mt-4 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">After Installing — Auto-Updates</p>
              <p className="text-xs text-slate-400 leading-relaxed">The app updates automatically when new versions ship. You&apos;ll see a notification banner, or it&apos;ll silently install when you reopen the app. Your SMTP credentials, send history, and drafts are always preserved.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Email Provider Cards */}
      <section id="provider" className="mb-8 scroll-mt-20">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
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
                <p className="text-xs text-slate-500">Two ways: Sign in with Google (1 click) or App Password</p>
              </div>
            </div>

            {/* Recommended: Sign in with Google */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0">
                  <Check size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Recommended: Sign in with Google</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Open Settings (gear icon) → click <strong className="text-white">&quot;Sign in with Google&quot;</strong>. Done in one click. No App Password needed.</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Or use App Password (manual)</p>

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
      </section>

      {/* How to Use */}
      <section id="how-to" className="mb-8 scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={20} className="text-violet-400" />
          <h2 className="text-lg font-bold text-white">How to Use Email Blaster Pro</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Settings, gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20", title: "Configure SMTP", desc: "Gear icon → Enter email + App Password → Test → Save" },
            { icon: FileText, gradient: "from-violet-500 to-indigo-500", glow: "shadow-violet-500/20", title: "Upload Resume", desc: "Drag & drop PDF/DOC. Auto-attaches to every email." },
            { icon: Mail, gradient: "from-blue-500 to-cyan-500", glow: "shadow-blue-500/20", title: "Compose Email", desc: "Write subject + body. Live Preview shows the result." },
            { icon: Users, gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/20", title: "Add Recipients", desc: "Manual entry, Name <email> format, or CSV upload." },
            { icon: Send, gradient: "from-red-500 to-pink-500", glow: "shadow-red-500/20", title: "Review & Send", desc: "Set delay (3-10s), hit Send, watch Activity log." },
            { icon: History, gradient: "from-cyan-500 to-blue-500", glow: "shadow-cyan-500/20", title: "Check History", desc: "Clock icon → Batches or By Email → Search & filter." },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="group bg-slate-900/60 backdrop-blur rounded-xl p-4 border border-slate-700/40 hover:border-slate-600/60 transition-all flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shrink-0 shadow-lg ${item.glow} group-hover:scale-105 transition-transform`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pro Tips */}
      <section id="tips" className="mb-8 scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-amber-400" />
          <h2 className="text-lg font-bold text-white">Pro Tips</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { tip: "3-10s delays", desc: "Avoids spam filters", icon: "⏱️", color: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30", text: "text-emerald-300" },
            { tip: "Under 50/batch", desc: "Split large lists", icon: "📦", color: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/30", text: "text-blue-300" },
            { tip: "Test yourself", desc: "Send to your own email", icon: "🧪", color: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/30", text: "text-amber-300" },
            { tip: "Check History", desc: "Verify delivery status", icon: "📊", color: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/30", text: "text-violet-300" },
            { tip: "CSV for bulk", desc: "name,email format", icon: "📄", color: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/30", text: "text-cyan-300" },
            { tip: "Install as PWA", desc: "Native app feel", icon: "📱", color: "from-pink-500/20 to-pink-500/5", border: "border-pink-500/30", text: "text-pink-300" },
          ].map((t, i) => (
            <div key={i} className={`bg-gradient-to-br ${t.color} backdrop-blur rounded-xl p-3 border ${t.border} hover:scale-[1.02] transition-transform`}>
              <div className="text-2xl mb-1">{t.icon}</div>
              <p className={`text-xs font-bold ${t.text}`}>{t.tip}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mb-8 scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={20} className="text-violet-400" />
          <h2 className="text-lg font-bold text-white">FAQ</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className={`bg-slate-900/40 backdrop-blur border rounded-xl overflow-hidden transition-all ${expandedFaq === i ? "border-violet-500/30" : "border-slate-700/30"}`}>
              <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="w-full flex items-center justify-between p-3.5 text-left hover:bg-white/[0.02] transition-colors">
                <span className="text-sm text-slate-200 pr-4 font-medium">{faq.q}</span>
                {expandedFaq === i ? <ChevronUp size={14} className="text-violet-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
              </button>
              {expandedFaq === i && <div className="px-3.5 pb-3.5 -mt-1"><p className="text-xs text-slate-400 leading-relaxed">{faq.a}</p></div>}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <div className="relative mt-8 mb-4 overflow-hidden rounded-2xl border border-violet-500/30">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-indigo-500/20 to-cyan-500/20" />
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent animate-pulse" />
        <div className="relative p-8 text-center">
          <Sparkle />
          <h3 className="text-xl font-bold text-white mb-2">Ready to Send?</h3>
          <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">Configure your SMTP settings and start sending bulk emails with resume attachments.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold shadow-lg shadow-violet-500/30 hover:from-violet-600 hover:to-indigo-600 transition-all">
            <Send size={18} />Start Sending Emails
          </Link>
        </div>
      </div>

      </div>
    </div>
  );
}
