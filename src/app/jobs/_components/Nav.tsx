"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Send, FileText, Users, FileBox, Bell, ArrowLeft } from "lucide-react";

const ITEMS = [
  { href: "/jobs", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/jobs/send", label: "Send", icon: Send },
  { href: "/jobs/templates", label: "Templates", icon: FileText },
  { href: "/jobs/contacts", label: "Contacts", icon: Users },
  { href: "/jobs/resumes", label: "Resumes", icon: FileBox },
  { href: "/jobs/followups", label: "Follow-ups", icon: Bell },
];

export function JobsNav() {
  const pathname = usePathname();
  return (
    <aside className="md:w-56 md:shrink-0 border-r border-slate-800/60 bg-slate-950/40 md:min-h-screen">
      <div className="p-4 border-b border-slate-800/60">
        <Link href="/" className="text-slate-400 hover:text-slate-100 text-xs flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back to Email Blaster
        </Link>
        <h1 className="text-lg font-semibold mt-2 text-slate-100">Job Mailer</h1>
        <p className="text-xs text-slate-500">Faster job applications</p>
      </div>
      <nav className="p-2 flex md:flex-col flex-row overflow-x-auto md:overflow-visible">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap ${
                active ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
