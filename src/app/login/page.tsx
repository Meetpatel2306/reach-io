"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginPage } from "auth-kit";
import { Send, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { authAdapter } from "@/lib/authAdapter";

function OAuthErrorBanner() {
  const params = useSearchParams();
  const err = params.get("oauth_error");
  const [dismissed, setDismissed] = useState(false);

  // Clean URL so the error doesn't persist on refresh
  useEffect(() => {
    if (err) {
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth_error");
      window.history.replaceState(null, "", url.toString());
    }
  }, [err]);

  if (!err || dismissed) return null;

  const messages: Record<string, string> = {
    not_configured: "Google OAuth isn't set up on the server. The admin needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Vercel environment variables.",
    missing_code: "Sign-in flow was incomplete. Please try again.",
    access_denied: "You denied permission. Please try again and allow access.",
    gmail_scope_not_granted: "Gmail send permission was NOT granted. The admin must add the gmail.send scope in Google Cloud Console → OAuth consent screen → Scopes.",
  };

  const message = messages[err] || `Error: ${decodeURIComponent(err)}`;

  return (
    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-2">
        <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-300">Google sign-in failed</p>
          <p className="text-xs text-slate-400 mt-1.5">{message}</p>
          {err === "not_configured" && (
            <p className="text-[11px] text-slate-500 mt-2">
              Use email + password sign-in below as an alternative.
            </p>
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 text-xs">×</button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <div className="max-w-md mx-auto px-4 pt-4">
          <OAuthErrorBanner />
        </div>
      </Suspense>
      <LoginPage
        adapter={authAdapter}
        brand={
          <>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Send size={20} className="text-white" />
            </div>
            <span className="text-2xl font-extrabold text-white">Reach.io</span>
          </>
        }
        onSuccessRedirect="/"
        note="Your account stays signed in until you sign out manually."
      />
    </>
  );
}
