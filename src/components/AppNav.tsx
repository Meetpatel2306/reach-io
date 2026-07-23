"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Mail, BellRing, FileText, History, BookOpen, Crown, LifeBuoy, Sparkles } from "lucide-react";

// Global compose mode — "ai" (dynamic) or "template" (static). Persisted in
// localStorage and broadcast via a CustomEvent so the compose page reacts live.
export const COMPOSE_MODE_KEY = "eb-compose-mode";
export const COMPOSE_MODE_EVENT = "eb-compose-mode";

export function getComposeMode(): "ai" | "template" {
  if (typeof window === "undefined") return "ai";
  return localStorage.getItem(COMPOSE_MODE_KEY) === "template" ? "template" : "ai";
}

export function setComposeModeGlobal(mode: "ai" | "template") {
  localStorage.setItem(COMPOSE_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent(COMPOSE_MODE_EVENT, { detail: mode }));
}

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
  const [mode, setMode] = useState<"ai" | "template">("ai");

  useEffect(() => {
    setMode(getComposeMode());
    const onMode = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "ai" || detail === "template") setMode(detail);
    };
    window.addEventListener(COMPOSE_MODE_EVENT, onMode);
    return () => window.removeEventListener(COMPOSE_MODE_EVENT, onMode);
  }, []);

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
              // Templates are a static-mode concept — hide the whole section in AI mode.
              if (href === "/templates" && mode === "ai") return null;
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

          {/* Global compose-mode toggle: OFF = AI dynamic, ON = saved templates */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-700/50">
            <Sparkles size={13} className={mode === "ai" ? "text-violet-400" : "text-slate-600"} />
            <button
              role="switch"
              aria-checked={mode === "template"}
              onClick={() => {
                const next = mode === "template" ? "ai" : "template";
                setMode(next);
                setComposeModeGlobal(next);
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                mode === "template" ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-slate-700"
              }`}
              title={mode === "template" ? "Using saved templates — switch off for AI drafts" : "AI mode — switch on to use saved templates"}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${mode === "template" ? "left-5" : "left-0.5"}`} />
            </button>
            <FileText size={13} className={mode === "template" ? "text-violet-400" : "text-slate-600"} />
          </div>
        </div>
      </nav>
      {/* Spacer so fixed nav never overlaps page content */}
      <div className="h-14" />
    </>
  );
}
