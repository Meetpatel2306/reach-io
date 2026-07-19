"use client";

import Link from "next/link";
import { Mail, Search } from "lucide-react";

// Segmented switch between the two modules. Outreach = violet, Job Finder = teal.
export function ModeToggle({ active }: { active: "outreach" | "jobs" }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-slate-700/60 bg-slate-800/50">
      <Link
        href="/"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          active === "outreach"
            ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <Mail size={14} /> Outreach
      </Link>
      <Link
        href="/jobs"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          active === "jobs"
            ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <Search size={14} /> Job Finder
      </Link>
    </div>
  );
}
