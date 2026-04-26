"use client";
import { CheckCircle, Info, XCircle, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom) + 90px)" }}>
      {toasts.map((t) => {
        const Icon = t.type === "success" ? CheckCircle : t.type === "error" ? XCircle : t.type === "warning" ? AlertTriangle : Info;
        const color = t.type === "success" ? "text-accent" : t.type === "error" ? "text-red-400" : t.type === "warning" ? "text-yellow-400" : "text-blue-400";
        return (
          <div key={t.id} className="pointer-events-auto toast text-sm">
            <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-secondary hover:text-white -mr-1" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
