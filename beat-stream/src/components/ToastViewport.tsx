"use client";
import { CheckCircle, Info, XCircle, X } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none">
      {toasts.map((t) => {
        const Icon = t.type === "success" ? CheckCircle : t.type === "error" ? XCircle : Info;
        return (
          <div
            key={t.id}
            className="pointer-events-auto glass border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl fade-in"
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${t.type === "success" ? "text-emerald-400" : t.type === "error" ? "text-red-400" : "text-blue-400"}`} />
            <span className="flex-1 text-sm">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-secondary hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
