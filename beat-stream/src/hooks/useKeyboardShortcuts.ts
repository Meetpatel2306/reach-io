"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";
import { useSettings } from "@/contexts/SettingsContext";

export function useKeyboardShortcuts(setShowShortcuts?: (v: boolean) => void) {
  const player = usePlayer();
  const lib = useLibrary();
  const { toast } = useToast();
  const { settings, update } = useSettings();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      // Ctrl/Cmd combos
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault(); router.push("/search"); return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        update({ theme: settings.theme === "dark" ? "light" : "dark" });
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault(); player.togglePlay(); break;
        case "ArrowRight":
          if (e.shiftKey) { e.preventDefault(); player.next(); }
          else { e.preventDefault(); player.seekTo(player.currentTime + 10); }
          break;
        case "ArrowLeft":
          if (e.shiftKey) { e.preventDefault(); player.prev(); }
          else { e.preventDefault(); player.seekTo(Math.max(0, player.currentTime - 10)); }
          break;
        case "ArrowUp":
          e.preventDefault(); player.setVolume(Math.min(1, player.volume + 0.1)); break;
        case "ArrowDown":
          e.preventDefault(); player.setVolume(Math.max(0, player.volume - 0.1)); break;
        case "m":
        case "M":
          player.toggleMute(); break;
        case "l":
        case "L":
          if (player.currentSong) {
            const a = lib.toggleLike(player.currentSong.id);
            toast(a ? "Added to Liked Songs" : "Removed from Liked Songs", a ? "success" : "info");
          }
          break;
        case "q":
        case "Q":
          if (player.expanded) player.setShowQueue(!player.showQueue);
          else router.push("/queue");
          break;
        case "f":
        case "F":
          player.setExpanded(!player.expanded); break;
        case "/":
          e.preventDefault();
          (document.getElementById("global-search") as HTMLInputElement | null)?.focus();
          break;
        case "Escape":
          if (player.showCarMode) player.setShowCarMode(false);
          else if (player.expanded) player.setExpanded(false);
          break;
        case "?":
          setShowShortcuts?.(true); break;
        case "1": router.push("/"); break;
        case "2": router.push("/search"); break;
        case "3": router.push("/library"); break;
        case "4": router.push("/settings"); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, lib, toast, router, settings.theme, update, setShowShortcuts]);
}
