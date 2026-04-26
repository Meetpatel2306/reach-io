"use client";
import { ReactNode } from "react";
import { ToastProvider } from "@/contexts/ToastContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "./ErrorBoundary";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <LibraryProvider>
              <PlayerProvider>{children}</PlayerProvider>
            </LibraryProvider>
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
