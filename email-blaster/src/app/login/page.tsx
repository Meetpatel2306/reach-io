"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, Send, ChevronRight, Clock, Infinity as InfinityIcon, AlertTriangle } from "lucide-react";

const SESSION_PRESETS = [
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { label: "Never", ms: 365 * 24 * 60 * 60 * 1000 * 10 },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionMs, setSessionMs] = useState(SESSION_PRESETS[1].ms); // 24h default
  const [customAmount, setCustomAmount] = useState(24);
  const [customUnit, setCustomUnit] = useState<"hours" | "days" | "weeks">("hours");
  const [useCustom, setUseCustom] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    fetch("/api/system-status").then((r) => r.json()).then((s) => {
      if (s.isVercel && !s.kv) setStorageWarning(true);
    }).catch(() => {});
  }, []);

  const computeMs = () => {
    if (!useCustom) return sessionMs;
    const factor = customUnit === "hours" ? 3600 : customUnit === "days" ? 86400 : 604800;
    return Math.max(1, customAmount) * factor * 1000;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, sessionMaxAgeMs: computeMs() }),
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30 mb-4">
            <Send size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to Email Blaster Pro</p>
        </div>

        {storageWarning && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Storage not configured</p>
              <p className="text-[11px] text-slate-400 mt-1">Vercel KV is not enabled. Accounts may not persist between sessions. Admin: enable KV in Vercel dashboard → Storage tab.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card !border-violet-500/20 space-y-4">
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
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Session expiry */}
          <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-violet-400" />
              <p className="text-xs font-semibold text-slate-200">Stay signed in for</p>
            </div>
            {!useCustom ? (
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {SESSION_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setSessionMs(p.ms)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                      sessionMs === p.ms
                        ? "bg-violet-500/20 text-violet-200 border-violet-500/40"
                        : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200"
                    }`}
                  >
                    {p.label === "Never" ? <span className="flex items-center justify-center gap-1"><InfinityIcon size={10} />Never</span> : p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  min={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(parseInt(e.target.value) || 1)}
                  className="input-field !py-1.5 !text-xs w-20"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as "hours" | "days" | "weeks")}
                  className="input-field !py-1.5 !text-xs flex-1"
                >
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => setUseCustom(!useCustom)}
              className="text-[10px] text-violet-400 hover:text-violet-300"
            >
              {useCustom ? "Use presets instead" : "Use custom duration"}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="flex justify-between text-xs">
            <Link href="/forgot-password" className="text-violet-400 hover:text-violet-300">Forgot password?</Link>
            <Link href="/register" className="text-slate-400 hover:text-violet-300">Create account →</Link>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          Email Blaster Pro · v6
        </p>
      </div>
    </div>
  );
}
