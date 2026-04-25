"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  type?: "info" | "success" | "error";
}

interface Ctx {
  toasts: Toast[];
  toast: (message: string, type?: Toast["type"]) => void;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => dismiss(id), 3000);
  }, [dismiss]);

  return <ToastCtx.Provider value={{ toasts, toast, dismiss }}>{children}</ToastCtx.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
