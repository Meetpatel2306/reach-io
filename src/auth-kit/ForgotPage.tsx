"use client";
import { useState, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "./AuthShell";
import type { AuthAdapter, ToastFn } from "./types";

export function ForgotPage({
  adapter, brand, toast, onSuccessRedirect = "/login", note,
}: {
  adapter: AuthAdapter;
  brand: ReactNode;
  toast?: ToastFn;
  onSuccessRedirect?: string;
  note?: ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const u = await adapter.byEmail(email);
      if (!u) { setErr("No account with that email"); }
      else if (!u.securityQuestion) {
        setErr("This account has no security question on file. Contact admin to reset.");
      } else {
        setQuestion(u.securityQuestion);
      }
    } catch { setErr("Lookup failed"); }
    setLoading(false);
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (newPassword.length < 4) { setErr("New password must be at least 4 characters"); return; }
    setLoading(true);
    try {
      await adapter.resetPassword(email, answer, newPassword);
      toast?.("Password reset — sign in with your new password", "success");
      router.push(onSuccessRedirect);
    } catch (e: any) { setErr(e?.message || "Reset failed"); }
    setLoading(false);
  }

  return (
    <AuthShell brand={brand} title="Reset password"
      subtitle={question ? "Answer your security question to set a new password" : "Enter your email to begin"}
      footer={<Link href="/login" className="text-accent hover:underline">Back to sign in</Link>}
      note={note}
    >
      {!question ? (
        <form onSubmit={lookup} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required autoFocus
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{err}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Continue
          </button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <div className="bg-white/5 rounded-lg p-3 text-sm">
            <div className="text-xs text-secondary mb-1">Your question</div>
            <div className="font-semibold">{question}</div>
          </div>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" required autoFocus
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" required
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{err}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Reset password
          </button>
        </form>
      )}
    </AuthShell>
  );
}
