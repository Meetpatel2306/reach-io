"use client";

import { LoginPage } from "auth-kit";
import { Send } from "lucide-react";
import { authAdapter } from "@/lib/authAdapter";

export default function Page() {
  return (
    <LoginPage
      adapter={authAdapter}
      brand={
        <>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Send size={20} className="text-white" />
          </div>
          <span className="text-2xl font-extrabold text-white">Email Blaster Pro</span>
        </>
      }
      onSuccessRedirect="/"
      note="Your account stays signed in until you sign out manually."
    />
  );
}
