"use client";
import { useState, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "./AuthShell";
import { AVATARS, SECURITY_QUESTIONS } from "./constants";
import type { AuthAdapter, ToastFn } from "./types";

export function RegisterPage({
  adapter, brand, toast, onSuccessRedirect = "/", note,
  subtitle = "Personalize the app — your data stays with this account",
}: {
  adapter: AuthAdapter;
  brand: ReactNode;
  toast?: ToastFn;
  onSuccessRedirect?: string;
  note?: ReactNode;
  subtitle?: string;
}) {
  const router = useRouter();
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
    if (!securityAnswer.trim()) { setErr("Security answer required"); return; }
    setLoading(true);
    try {
      const u = await adapter.register({ email, displayName: name, password, avatar, securityQuestion, securityAnswer });
      toast?.(`Welcome, ${u.displayName}!${u.isAdmin ? " (Admin)" : ""}`, "success");
      router.push(onSuccessRedirect);
    } catch (e: any) { setErr(e?.message || "Registration failed"); }
    setLoading(false);
  }

  return (
    <AuthShell brand={brand} title="Create your account" subtitle={subtitle}
      footer={<>Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link></>}
      note={note}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldInput label="Display name" value={name} onChange={setName} required autoFocus />
          <FieldInput label="Email" type="email" value={email} onChange={setEmail} required />
        </div>

        <div>
          <Label>Avatar</Label>
          <div className="grid grid-cols-10 gap-1.5 mt-1.5">
            {AVATARS.map((a) => (
              <button key={a} type="button" onClick={() => setAvatar(a)}
                className={`w-8 h-8 rounded-full text-base flex items-center justify-center transition ${avatar === a ? "bg-accent text-black" : "bg-white/5 hover:bg-white/15"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldInput label="Password" type="password" value={password} onChange={setPassword} required />
          <FieldInput label="Confirm" type="password" value={confirm} onChange={setConfirm} required />
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="text-xs text-secondary mb-2">For password recovery (no email — just a security question).</div>
          <Label>Security question</Label>
          <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)}
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm mt-1.5 mb-2">
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

function Label({ children }: { children: ReactNode }) {
  return <label className="text-xs uppercase tracking-wider font-bold text-secondary block">{children}</label>;
}
function FieldInput(props: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; autoFocus?: boolean }) {
  return (
    <div>
      <Label>{props.label}</Label>
      <input type={props.type || "text"} value={props.value} onChange={(e) => props.onChange(e.target.value)} required={props.required} autoFocus={props.autoFocus}
        className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-accent text-sm mt-1.5" />
    </div>
  );
}
