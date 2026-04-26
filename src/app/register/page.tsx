"use client";

import { RegisterPage } from "auth-kit";
import { Send } from "lucide-react";
import { authAdapter } from "@/lib/authAdapter";

export default function Page() {
  return (
    <RegisterPage
      adapter={authAdapter}
      brand={
        <>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Send size={20} className="text-white" />
          </div>
          <span className="text-2xl font-extrabold text-white">Reach.io</span>
        </>
      }
      onSuccessRedirect="/login"
      subtitle="Send bulk emails with your own credentials"
      note="Pick a security question — you'll use it to recover your password if you forget."
    />
  );
}
