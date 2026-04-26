"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, Settings, ListMusic, Heart, Headphones, Clock, Sparkles, Plus } from "lucide-react";
import { useLibrary } from "@/contexts/LibraryContext";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Your Library", icon: Library },
];

const secondary = [
  { href: "/history", label: "History", icon: Clock },
  { href: "/wrapped", label: "Wrapped", icon: Sparkles },
  { href: "/queue", label: "Queue", icon: ListMusic },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const { userPlaylists, createPlaylist } = useLibrary();
  const [filter, setFilter] = useState("");

  const filtered = userPlaylists.filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-64 h-screen sticky top-0 p-2 gap-2">
      <div className="bg-card-strong rounded-xl p-4 mb-1">
        <Link href="/" className="flex items-center gap-2 mb-2 px-2">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shadow-accent-glow">
            <Headphones className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">BeatStream</span>
        </Link>
        <nav className="flex flex-col gap-0.5 mt-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== "/" && path?.startsWith(href));
            return (
              <Link key={href} href={href} className={`nav-link ${active ? "active" : ""}`}>
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="bg-card-strong rounded-xl p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">Library</span>
          <button
            onClick={() => {
              const name = prompt("Playlist name?");
              if (name) createPlaylist(name);
            }}
            className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-secondary hover:text-white"
            aria-label="Create playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search in library"
          className="bg-white/5 hover:bg-white/10 focus:bg-white/10 rounded-md px-3 py-1.5 text-xs outline-none placeholder:text-secondary mb-2 transition"
        />
        <div className="flex-1 overflow-y-auto -mx-2 px-2 no-scrollbar">
          <Link href="/library?tab=songs" className="nav-link !py-2">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-purple-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <Heart className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white line-clamp-1">Liked Songs</div>
              <div className="text-[11px] text-secondary">Playlist</div>
            </div>
          </Link>
          {filtered.map((p) => (
            <Link key={p.id} href={`/playlist/user/${p.id}`} className="nav-link !py-2">
              <div className="w-9 h-9 rounded-md bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                <ListMusic className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-white line-clamp-1">{p.name}</div>
                <div className="text-[11px] text-secondary">{p.songIds.length} songs</div>
              </div>
            </Link>
          ))}
        </div>
        <nav className="border-t border-white/5 pt-2 mt-2 flex flex-col gap-0.5">
          {secondary.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link key={href} href={href} className={`nav-link !py-2 ${active ? "active" : ""}`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
