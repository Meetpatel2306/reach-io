"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { useToast } from "@/contexts/ToastContext";
import { AuthShell } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const u = auth.byEmail(email);
    if (!u) { setErr("No account with that email"); return; }
    setQuestion(u.securityQuestion);
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (newPassword.length < 4) { setErr("New password must be at least 4 characters"); return; }
    setLoading(true);
    try {
      await auth.resetPassword(email, answer, newPassword);
      toast("Password reset — sign in with your new password", "success");
      router.push("/login");
    } catch (e: any) { setErr(e?.message || "Reset failed"); }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={question ? `Answer your security question to set a new password` : "Enter your email to begin"}
      footer={<><Link href="/login" className="text-accent hover:underline">Back to sign in</Link></>}
    >
      {!question ? (
        <form onSubmit={lookup} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required autoFocus
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{err}</div>}
          <button type="submit" className="btn-primary w-full">Continue</button>
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
