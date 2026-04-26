"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2, KeyRound, Check } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
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
      <div className="glass-card !border-emerald-500/30 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Password Reset!</h2>
        <p className="text-sm text-slate-400">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card !border-amber-500/20 space-y-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">New Password</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type={showPass ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-field pl-10 pr-10" />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400">
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Confirm Password</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type={showPass ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="input-field pl-10" />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">{error}</div>
      )}

      <button type="submit" disabled={loading || !token} className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
        {loading ? "Resetting..." : "Reset Password"}
      </button>

      <Link href="/login" className="block text-center text-xs text-slate-400 hover:text-violet-300">Back to login</Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 mb-4">
            <KeyRound size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set New Password</h1>
        </div>
        <Suspense fallback={<div className="glass-card text-center"><Loader2 className="animate-spin mx-auto" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
