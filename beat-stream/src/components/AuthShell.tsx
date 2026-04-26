"use client";
import Link from "next/link";
import { Headphones } from "lucide-react";
import { ReactNode } from "react";

/** Shared chrome for the login / register / forgot-password pages. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 fade-in">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shadow-accent-glow">
            <Headphones className="w-6 h-6 text-black" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">BeatStream</span>
        </Link>
        <div className="bg-card rounded-2xl p-6 sm:p-8 border border-white/5 shadow-2xl">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="text-center text-sm text-secondary mt-4">{footer}</div>}
        <p className="text-[11px] text-secondary/60 text-center mt-6 max-w-sm mx-auto">
          BeatStream profiles live in your browser only — there's no server. Use this to personalize the
          app for multiple people sharing this device.
        </p>
      </div>
    </div>
  );
}
