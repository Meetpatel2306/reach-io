"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2, KeyRound, Check, ArrowRight, AlertTriangle, Sparkles } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError("No reset token provided. Use the link from the forgot password page.");
  }, [token]);

  const checks = [
    { label: "At least 6 characters", pass: password.length >= 6 },
    { label: "Passwords match", pass: !!password && password === confirm },
  ];
  const allValid = checks.every((c) => c.pass);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!allValid) { setError("Please meet all requirements"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="glass-card !border-emerald-500/30 !p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/40 mb-4">
          <Check size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Password updated</h2>
        <p className="text-sm text-slate-400 mb-1">Your new password is set.</p>
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Loader2 size={11} className="animate-spin" />
          Redirecting to sign in...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card !border-amber-500/20 !p-6 space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Lock size={12} className="text-amber-400" />
          New password
        </label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a new password"
            className="input-field pr-10"
            autoFocus
          />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400" tabIndex={-1}>
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Lock size={12} className="text-amber-400" />
          Confirm password
        </label>
        <input
          type={showPass ? "text" : "password"}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter new password"
          className="input-field"
        />
      </div>

      {/* Live checks */}
      {password && (
        <div className="bg-slate-800/30 rounded-lg p-2.5 border border-slate-700/30 space-y-1.5">
          {checks.map((c, i) => (
            <div key={i} className={`flex items-center gap-2 text-[11px] ${c.pass ? "text-emerald-400" : "text-slate-500"}`}>
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${c.pass ? "bg-emerald-500/20" : "bg-slate-700/50"}`}>
                {c.pass && <Check size={9} />}
              </div>
              {c.label}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !token || !allValid}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 disabled:opacity-50 transition-all"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" />Updating...</>
        ) : (
          <>Update password<ArrowRight size={16} /></>
        )}
      </button>

      <Link href="/login" className="block text-center text-xs text-slate-400 hover:text-amber-300 transition-colors">
        Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-2xl shadow-amber-500/40 mb-4">
            <KeyRound size={28} className="text-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950 flex items-center justify-center">
              <Sparkles size={8} className="text-slate-950" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">New password</h1>
          <p className="text-sm text-slate-400 mt-1.5">Set a new password for your account</p>
        </div>

        <Suspense fallback={
          <div className="glass-card text-center !p-8">
            <Loader2 className="animate-spin mx-auto text-amber-400" size={28} />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
