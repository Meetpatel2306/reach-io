"use client";
import { useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useToast } from "@/contexts/ToastContext";

export function useKeyboardShortcuts() {
  const player = usePlayer();
  const lib = useLibrary();
  const { toast } = useToast();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          player.togglePlay();
          break;
        case "ArrowRight":
          if (e.shiftKey) { e.preventDefault(); player.next(); }
          else { e.preventDefault(); player.seekTo(player.currentTime + 10); }
          break;
        case "ArrowLeft":
          if (e.shiftKey) { e.preventDefault(); player.prev(); }
          else { e.preventDefault(); player.seekTo(Math.max(0, player.currentTime - 10)); }
          break;
        case "ArrowUp":
          e.preventDefault();
          player.setVolume(Math.min(1, player.volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          player.setVolume(Math.max(0, player.volume - 0.1));
          break;
        case "m":
        case "M":
          player.toggleMute();
          break;
        case "l":
        case "L":
          if (player.currentSong) {
            const added = lib.toggleLike(player.currentSong.id);
            toast(added ? "Added to Liked Songs" : "Removed from Liked Songs", added ? "success" : "info");
          }
          break;
        case "q":
        case "Q":
          player.setShowQueue(!player.showQueue);
          break;
        case "f":
        case "F":
          player.setExpanded(!player.expanded);
          break;
        case "/":
          e.preventDefault();
          (document.getElementById("global-search") as HTMLInputElement | null)?.focus();
          break;
        case "k":
        case "K":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            window.location.href = "/search";
          }
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, lib, toast]);
}
