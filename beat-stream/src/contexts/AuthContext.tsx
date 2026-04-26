"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { auth, type UserProfile } from "@/lib/auth";

interface Ctx {
  user: UserProfile | null;
  loading: boolean;
  refresh: () => void;
  logout: () => void;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setUser(auth.current());
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
    setLoading(false);
    // Listen for storage events from other tabs so logout/login sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === "bs-auth-current" || e.key === "bs-auth-profiles") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return <AuthCtx.Provider value={{ user, loading, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
