"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { auth } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const u = await auth.login(email, password);
      refresh();
      toast(`Welcome back, ${u.displayName}`, "success");
      router.push("/");
    } catch (e: any) { setErr(e?.message || "Login failed"); }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back"
      footer={<>No account? <Link href="/register" className="text-accent hover:underline">Sign up</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Email</label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 pr-10 outline-none focus:border-accent text-sm"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-white p-1">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Link href="/forgot-password" className="text-xs text-accent hover:underline mt-2 inline-block">Forgot password?</Link>
        </div>
        {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{err}</div>}
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
        </button>
      </form>
    </AuthShell>
  );
}
