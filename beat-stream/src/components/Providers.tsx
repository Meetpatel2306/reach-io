"use client";
import { ReactNode } from "react";
import { ToastProvider } from "@/contexts/ToastContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { PlayerProvider } from "@/contexts/PlayerContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SettingsProvider>
        <LibraryProvider>
          <PlayerProvider>{children}</PlayerProvider>
        </LibraryProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
