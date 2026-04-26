"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, Settings } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="md:hidden fixed left-0 right-0 bottom-0 z-40 glass" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path?.startsWith(href));
          return (
            <Link key={href} href={href} className="flex-1 flex flex-col items-center gap-0.5 py-2 relative">
              <div className={`relative transition-all ${active ? "text-accent scale-105" : "text-secondary"}`}>
                <Icon className="w-6 h-6" />
                {active && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-accent" />}
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-accent" : "text-secondary"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
