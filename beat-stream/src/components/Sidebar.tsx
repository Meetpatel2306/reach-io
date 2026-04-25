"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, Settings, Headphones, ListMusic, Heart } from "lucide-react";
import { useLibrary } from "@/contexts/LibraryContext";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const { userPlaylists } = useLibrary();
  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-64 bg-black h-screen sticky top-0 p-4 gap-2 border-r border-white/5">
      <Link href="/" className="flex items-center gap-2 mb-4 px-3 py-2">
        <Headphones className="w-7 h-7 text-accent" />
        <span className="text-xl font-bold">BeatStream</span>
      </Link>
      <nav className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${active ? "bg-card text-white" : "text-secondary hover:text-white"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 pt-4 border-t border-white/5 flex-1 overflow-y-auto">
        <Link href="/library" className="flex items-center gap-3 px-3 py-2 text-secondary hover:text-white text-sm font-semibold uppercase tracking-wider">
          Your Playlists
        </Link>
        <Link href="/library?tab=songs" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card text-secondary hover:text-white">
          <Heart className="w-4 h-4 text-accent" />
          <span className="text-sm">Liked Songs</span>
        </Link>
        {userPlaylists.map((p) => (
          <Link
            key={p.id}
            href={`/playlist/user/${p.id}`}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card text-secondary hover:text-white"
          >
            <ListMusic className="w-4 h-4" />
            <span className="text-sm line-clamp-1">{p.name}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
