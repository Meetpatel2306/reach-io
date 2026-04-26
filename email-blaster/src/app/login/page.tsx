"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, Send, ArrowRight, AlertTriangle, Sparkles, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    fetch("/api/system-status").then((r) => r.json()).then((s) => {
      if (s.isVercel && !s.kv) setStorageWarning(true);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-2xl shadow-violet-500/40 mb-4">
            <Send size={28} className="text-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950 flex items-center justify-center">
              <Sparkles size={8} className="text-slate-950" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-sm text-slate-400 mt-1.5">Sign in to your Email Blaster account</p>
        </div>

        {storageWarning && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Storage not configured</p>
              <p className="text-[11px] text-slate-400 mt-1">Vercel KV / Upstash isn&apos;t connected — accounts won&apos;t persist between sessions.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card !border-violet-500/20 !p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Mail size={12} className="text-violet-400" />
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input-field"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock size={12} className="text-violet-400" />
                Password
              </label>
              <Link href="/forgot-password" className="text-[11px] text-violet-400 hover:text-violet-300">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-field pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400 transition-colors"
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
              <Shield size={10} />
              You&apos;ll stay signed in until you sign out manually
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:from-violet-600 hover:to-indigo-600 disabled:opacity-60 transition-all"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" />Signing in...</>
            ) : (
              <>Sign in<ArrowRight size={16} /></>
            )}
          </button>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-slate-700/40" />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-700/40" />
          </div>

          <Link
            href="/register"
            className="block w-full text-center px-4 py-2.5 rounded-xl bg-slate-800/50 text-slate-300 border border-slate-700/50 text-sm hover:bg-slate-700/50 hover:border-violet-500/30 hover:text-white transition-all"
          >
            Create a new account
          </Link>
        </form>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-[10px] text-slate-600">
          <Shield size={10} />
          <span>Secured with end-to-end encryption</span>
        </div>
      </div>
    </div>
  );
}
