"use client";

import Link from "next/link";
import { ArrowLeft, BellRing } from "lucide-react";
import { FollowUpsPanel } from "@/components/jobs/FollowUpsPanel";

// Dedicated follow-ups page. One click checks Gmail for a reply first, then
// sends the professional follow-up inside the original email thread.
export default function FollowUpsPage() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <BellRing size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Follow-ups</h1>
          <p className="text-slate-500 text-xs">One follow-up per person, ever — sent as a reply in the original thread.</p>
        </div>
      </div>

      <FollowUpsPanel standalone />
    </div>
  );
}
