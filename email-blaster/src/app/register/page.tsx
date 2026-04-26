"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, Send, ChevronRight, Check, AlertTriangle } from "lucide-react";

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

  const passwordChecks = [
    { label: "At least 6 characters", pass: password.length >= 6 },
    { label: "Passwords match", pass: !!password && password === confirm },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
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
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30 mb-4">
            <Send size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-sm text-slate-400 mt-1">Get started with Email Blaster Pro</p>
        </div>

        {storageWarning && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Storage not configured — your account may not persist</p>
              <p className="text-[11px] text-slate-400 mt-1">Enable Vercel KV in dashboard → Storage tab → Create KV Database → Connect to Project. Then redeploy.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card !border-emerald-500/20 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Full Name</label>
            <div className="relative">
              <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="input-field pl-10"
                autoComplete="name"
              />
            </div>
          </div>

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
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPass ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field pl-10 pr-10"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Confirm Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPass ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="input-field pl-10"
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Password requirements */}
          <div className="space-y-1">
            {passwordChecks.map((c, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-[11px] ${c.pass ? "text-emerald-400" : "text-slate-500"}`}>
                <Check size={11} className={c.pass ? "" : "opacity-30"} />
                {c.label}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passwordChecks.every((c) => c.pass)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Already have an account? <Link href="/login" className="text-violet-400 hover:text-violet-300">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
