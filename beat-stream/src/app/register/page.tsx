"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { auth, SECURITY_QUESTIONS } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { AuthShell } from "@/components/AuthShell";

const AVATARS = ["🎵","🎧","🎸","🎹","🎤","🎷","🥁","🎻","🎺","🎶","🦊","🐱","🐶","🦁","🐼","🐯"];

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[1]);
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 4) { setErr("Password must be at least 4 characters"); return; }
    if (password !== confirm) { setErr("Passwords don't match"); return; }
    if (!securityAnswer.trim()) { setErr("Security answer required for password recovery"); return; }
    setLoading(true);
    try {
      const u = await auth.register({ email, displayName: name, password, avatar, securityQuestion, securityAnswer });
      refresh();
      toast(`Welcome, ${u.displayName}!${u.isAdmin ? " (Admin)" : ""}`, "success");
      router.push("/");
    } catch (e: any) { setErr(e?.message || "Registration failed"); }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Create your profile"
      subtitle="Personalize BeatStream — your playlists, history, and stats stay with this account"
      footer={<>Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Avatar</label>
          <div className="grid grid-cols-8 gap-1.5">
            {AVATARS.map((a) => (
              <button key={a} type="button" onClick={() => setAvatar(a)}
                className={`w-9 h-9 rounded-full text-lg flex items-center justify-center transition ${avatar === a ? "bg-accent text-black" : "bg-white/5 hover:bg-white/15"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Confirm</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
          </div>
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="text-xs text-secondary mb-2">For password recovery — there's no email server, so we use a security question.</div>
          <label className="text-xs uppercase tracking-wider font-bold text-secondary block mb-1.5">Security question</label>
          <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)}
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm mb-2">
            {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <input value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} placeholder="Answer (case-insensitive)" required
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm" />
        </div>

        {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{err}</div>}
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create account
        </button>
      </form>
    </AuthShell>
  );
}
