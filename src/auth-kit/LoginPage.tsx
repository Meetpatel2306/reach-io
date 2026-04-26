"use client";
import { useState, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "./AuthShell";
import type { AuthAdapter, ToastFn } from "./types";

export function LoginPage({
  adapter, brand, toast, onSuccessRedirect = "/", note,
}: {
  adapter: AuthAdapter;
  brand: ReactNode;
  toast?: ToastFn;
  onSuccessRedirect?: string;
  note?: ReactNode;
}) {
  const router = useRouter();
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
      const u = await adapter.login(email, password);
      toast?.(`Welcome back, ${u.displayName}`, "success");
      router.push(onSuccessRedirect);
    } catch (e: any) { setErr(e?.message || "Login failed"); }
    setLoading(false);
  }

  return (
    <AuthShell brand={brand} title="Sign in" subtitle="Welcome back"
      footer={<>No account? <Link href="/register" className="text-accent hover:underline">Sign up</Link></>}
      note={note}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
        </Field>
        <Field label="Password" hint={<Link href="/forgot-password" className="text-xs text-accent hover:underline">Forgot password?</Link>}>
          <div className="relative">
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 pr-10 outline-none focus:border-accent text-sm" />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-white p-1">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        {err && <ErrBox>{err}</ErrBox>}
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
        </button>
      </form>
    </AuthShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs uppercase tracking-wider font-bold text-secondary">{label}</label>
        {hint}
      </div>
      {children}
    </div>
  );
}

function ErrBox({ children }: { children: ReactNode }) {
  return <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{children}</div>;
}
