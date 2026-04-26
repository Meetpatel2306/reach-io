"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, Send, ArrowRight,
  Check, AlertTriangle, Sparkles, Shield, X
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    fetch("/api/system-status").then((r) => r.json()).then((s) => {
      if (s.isVercel && !s.kv) setStorageWarning(true);
    }).catch(() => {});
  }, []);

  const checks = [
    { label: "At least 6 characters", pass: password.length >= 6 },
    { label: "Passwords match", pass: !!password && password === confirm },
  ];
  const allValid = checks.every((c) => c.pass) && !!email && !!name;

  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        setRegistered(true);
        // Redirect to login after a brief success display
        setTimeout(() => router.push("/login"), 1500);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  // Password strength indicator
  const strength = password.length === 0 ? 0 :
    password.length < 6 ? 1 :
    password.length < 10 ? 2 :
    password.length < 14 ? 3 : 4;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["bg-slate-700", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"][strength];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-2xl shadow-emerald-500/40 mb-4">
            <Send size={28} className="text-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 flex items-center justify-center">
              <Sparkles size={8} className="text-slate-950" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create account</h1>
          <p className="text-sm text-slate-400 mt-1.5">Start sending emails in minutes</p>
        </div>

        {/* Storage warning */}
        {storageWarning && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Storage not configured</p>
              <p className="text-[11px] text-slate-400 mt-1">Your account may not persist. Admin needs to enable Vercel KV / Upstash.</p>
            </div>
          </div>
        )}

        {registered ? (
          <div className="glass-card !border-emerald-500/30 !p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/40 mb-4">
              <Check size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Account created!</h2>
            <p className="text-sm text-slate-400 mb-3">Please sign in with your new credentials.</p>
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              Redirecting to sign in...
            </p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="glass-card !border-emerald-500/20 !p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <UserIcon size={12} className="text-emerald-400" />
              Full name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="input-field"
              autoComplete="name"
              autoFocus
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Mail size={12} className="text-emerald-400" />
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
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Lock size={12} className="text-emerald-400" />
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                className="input-field pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength meter */}
            {password && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i <= strength ? strengthColor : "bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[10px] font-medium ${
                  strength === 1 ? "text-red-400" :
                  strength === 2 ? "text-amber-400" :
                  strength === 3 ? "text-blue-400" :
                  strength === 4 ? "text-emerald-400" : "text-slate-500"
                }`}>
                  {strengthLabel}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Lock size={12} className="text-emerald-400" />
              Confirm password
            </label>
            <input
              type={showPass ? "text" : "password"}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              className="input-field"
              autoComplete="new-password"
            />
          </div>

          {/* Live checks */}
          <div className="bg-slate-800/30 rounded-lg p-2.5 border border-slate-700/30 space-y-1.5">
            {checks.map((c, i) => (
              <div key={i} className={`flex items-center gap-2 text-[11px] transition-colors ${c.pass ? "text-emerald-400" : "text-slate-500"}`}>
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${c.pass ? "bg-emerald-500/20" : "bg-slate-700/50"}`}>
                  {c.pass ? <Check size={9} /> : <X size={9} className="opacity-50" />}
                </div>
                {c.label}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !allValid}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" />Creating account...</>
            ) : (
              <>Create account<ArrowRight size={16} /></>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-slate-700/40" />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-700/40" />
          </div>

          {/* Login link */}
          <Link
            href="/login"
            className="block w-full text-center px-4 py-2.5 rounded-xl bg-slate-800/50 text-slate-300 border border-slate-700/50 text-sm hover:bg-slate-700/50 hover:border-emerald-500/30 hover:text-white transition-all"
          >
            I already have an account
          </Link>
        </form>
        )}

        {/* Trust badge */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-[10px] text-slate-600">
          <Shield size={10} />
          <span>Your password is encrypted with bcrypt</span>
        </div>
      </div>
    </div>
  );
}
