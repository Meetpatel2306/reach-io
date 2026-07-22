"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Mail, BellRing, FileText, History, BookOpen, Crown, LifeBuoy } from "lucide-react";

// The one fixed panel shown on every signed-in page: brand + primary navigation.
// Hidden on public/auth pages. Page-specific controls (settings, user menu)
// stay on their pages — this bar is purely for moving around the product.

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/privacy", "/terms"];

const LINKS = [
  { href: "/", label: "Compose", icon: Mail },
  { href: "/followups", label: "Follow-ups", icon: BellRing },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/history", label: "History", icon: History },
  { href: "/guide", label: "Guide", icon: BookOpen },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

export function AppNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSignedIn(!!d.user);
        setIsAdmin(d.user?.role === "admin");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return null;
  if (!signedIn) return null;

  return (
    <>
      <nav className="app-nav">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 mr-2 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Send size={15} className="text-white" />
            </span>
            <span className="hidden md:block font-bold text-white tracking-tight">Reach.io</span>
          </Link>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href} className={`nav-link ${active ? "nav-link-active" : ""}`}>
                  <Icon size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className={`nav-link ${pathname === "/admin" ? "nav-link-admin-active" : "nav-link-admin"}`}
              >
                <Crown size={15} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
          </div>
        </div>
      </nav>
      {/* Spacer so fixed nav never overlaps page content */}
      <div className="h-14" />
    </>
  );
}
