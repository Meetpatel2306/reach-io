"use client";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="bg-orange-500/10 text-orange-400 border-b border-orange-500/30 px-4 py-2 text-sm flex items-center gap-2">
      <WifiOff className="w-4 h-4" />
      You&apos;re offline — only downloaded and cached songs will play
    </div>
  );
}
