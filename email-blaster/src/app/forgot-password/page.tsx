"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, KeyRound, ArrowLeft, Copy, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 mb-4">
            <KeyRound size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-sm text-slate-400 mt-1">We&apos;ll generate a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card !border-amber-500/20 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="input-field pl-10"
              />
            </div>
          </div>

          {message && (
            <div className={`rounded-lg p-3 text-xs ${resetUrl ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border border-amber-500/30 text-amber-300"}`}>
              {message}
            </div>
          )}

          {resetUrl && (
            <div className="bg-slate-900/60 rounded-xl p-3 border border-violet-500/20 space-y-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Your reset link (expires in 1 hour)</p>
              <code className="block text-[11px] text-violet-300 break-all bg-slate-800/50 p-2 rounded">{resetUrl}</code>
              <button type="button" onClick={copyLink} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs hover:bg-violet-500/20">
                {copied ? <><Check size={11} />Copied!</> : <><Copy size={11} />Copy Link</>}
              </button>
              <p className="text-[10px] text-slate-500">Open this link to set a new password.</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {loading ? "Generating..." : "Generate Reset Link"}
          </button>

          <Link href="/login" className="flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-violet-300">
            <ArrowLeft size={12} />Back to login
          </Link>
        </form>
      </div>
    </div>
  );
}
