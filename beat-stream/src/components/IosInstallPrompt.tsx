"use client";
import { useEffect, useState } from "react";
import { Share, Plus, X, Smartphone } from "lucide-react";
import { store, STORAGE_KEYS } from "@/lib/storage";

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const inStandalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (!isIOS || inStandalone) return;
    const dismissed = store.read<number>(STORAGE_KEYS.iosInstallDismissed, 0);
    if (Date.now() - dismissed < THREE_DAYS) return;
    const id = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(id);
  }, []);

  if (!show) return null;

  function dismiss() {
    store.write(STORAGE_KEYS.iosInstallDismissed, Date.now());
    setShow(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 install-hint" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
      <div className="max-w-md mx-auto bg-card rounded-2xl border border-white/10 shadow-2xl p-5 fade-in">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base">Install BeatStream</h3>
            <p className="text-xs text-secondary mt-0.5">Get the full app — works offline, lock screen controls, no browser bar</p>
          </div>
          <button onClick={dismiss} className="text-secondary hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>
        <ol className="text-sm space-y-2 mb-4">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent text-black text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <span>Tap the Share button <Share className="inline w-4 h-4 mx-1 -mt-1" /> at the bottom</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent text-black text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <span>Scroll and tap <span className="inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded text-xs">Add to Home Screen <Plus className="w-3 h-3" /></span></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent text-black text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <span>Tap <strong>Add</strong> in the top right</span>
          </li>
        </ol>
        <button onClick={dismiss} className="w-full text-sm text-secondary hover:text-white py-2">Maybe later</button>
      </div>
    </div>
  );
}
