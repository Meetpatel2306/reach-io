"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, Settings } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const path = usePathname();
  const { currentSong } = usePlayer();
  return (
    <nav className={`md:hidden fixed left-0 right-0 z-40 glass border-t border-white/10 ${currentSong ? "bottom-0" : "bottom-0"}`}>
      <div className="flex items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition ${active ? "text-accent" : "text-secondary"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
