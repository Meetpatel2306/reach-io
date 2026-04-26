"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, KeyRound, ArrowLeft, Copy, Check, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setResetUrl("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
      if (data.adminToken) {
        setResetUrl(`${window.location.origin}/reset-password?token=${data.adminToken}`);
      }
    } catch {
      setMessage("Network error");
    }
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-2xl shadow-amber-500/40 mb-4">
            <KeyRound size={28} className="text-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-400 border-2 border-slate-950 flex items-center justify-center">
              <Sparkles size={8} className="text-slate-950" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reset password</h1>
          <p className="text-sm text-slate-400 mt-1.5">We&apos;ll generate a secure reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card !border-amber-500/20 !p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Mail size={12} className="text-amber-400" />
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input-field"
              autoFocus
            />
            <p className="text-[10px] text-slate-500 mt-1">Enter the email associated with your account.</p>
          </div>

          {message && !resetUrl && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {resetUrl && (
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-300">Reset link generated</p>
              </div>
              <p className="text-[11px] text-slate-400">Open this link in your browser to set a new password. Expires in 1 hour.</p>
              <code className="block text-[11px] text-violet-300 break-all bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/30 leading-relaxed">{resetUrl}</code>
              <button
                type="button"
                onClick={copyLink}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/30 text-xs font-medium hover:bg-violet-500/20 transition-all"
              >
                {copied ? <><Check size={12} />Copied to clipboard</> : <><Copy size={12} />Copy reset link</>}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" />Generating...</>
            ) : (
              <>Generate reset link<ArrowRight size={16} /></>
            )}
          </button>

          <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-violet-300 transition-colors">
            <ArrowLeft size={12} />Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
