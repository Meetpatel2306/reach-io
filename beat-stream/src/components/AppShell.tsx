"use client";
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MiniPlayer } from "./MiniPlayer";
import { FullPlayer } from "./FullPlayer";
import { ToastViewport } from "./ToastViewport";
import { OfflineBanner } from "./OfflineBanner";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlayer } from "@/contexts/PlayerContext";

export function AppShell({ children }: { children: ReactNode }) {
  useKeyboardShortcuts();
  const { currentSong } = usePlayer();
  return (
    <div className="flex min-h-screen bg-bg text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        <main className={`flex-1 overflow-y-auto ${currentSong ? "pb-44 md:pb-28" : "pb-20 md:pb-4"}`}>
          {children}
        </main>
      </div>
      <MiniPlayer />
      <FullPlayer />
      <BottomNav />
      <ToastViewport />
    </div>
  );
}
