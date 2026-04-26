"use client";
import Link from "next/link";
import { ReactNode } from "react";

/**
 * Shared chrome for login / register / forgot pages.
 * Pass a `brand` prop so each app can render its own logo/title.
 */
export function AuthShell({ brand, title, subtitle, children, footer, note }: {
  brand: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 fade-in">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-6">{brand}</Link>
        <div className="bg-card rounded-2xl p-6 sm:p-8 border border-white/5 shadow-2xl">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="text-center text-sm text-secondary mt-4">{footer}</div>}
        {note && <p className="text-[11px] text-secondary/60 text-center mt-6 max-w-sm mx-auto">{note}</p>}
      </div>
    </div>
  );
}
