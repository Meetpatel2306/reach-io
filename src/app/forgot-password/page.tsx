"use client";

import { ForgotPage } from "auth-kit";
import { Send } from "lucide-react";
import { authAdapter } from "@/lib/authAdapter";

export default function Page() {
  return (
    <ForgotPage
      adapter={authAdapter}
      brand={
        <>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Send size={20} className="text-white" />
          </div>
          <span className="text-2xl font-extrabold text-white">Email Blaster Pro</span>
        </>
      }
      onSuccessRedirect="/login"
    />
  );
}
