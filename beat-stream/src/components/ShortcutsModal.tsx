"use client";
import { X } from "lucide-react";

const shortcuts: [string, string][] = [
  ["Space", "Play / Pause"],
  ["→", "Skip forward 10s"],
  ["←", "Rewind 10s"],
  ["Shift + →", "Next song"],
  ["Shift + ←", "Previous song"],
  ["↑ / ↓", "Volume up / down"],
  ["M", "Mute / Unmute"],
  ["L", "Like / Unlike current song"],
  ["Q", "Toggle queue"],
  ["F", "Fullscreen player"],
  ["/", "Focus search"],
  ["Ctrl/Cmd + K", "Search"],
  ["Esc", "Close modal / Go back"],
  ["1", "Home"],
  ["2", "Search"],
  ["3", "Library"],
  ["4", "Settings"],
  ["?", "Show this menu"],
  ["Ctrl + Shift + D", "Toggle theme"],
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
          {shortcuts.map(([k, d]) => (
            <div key={k} className="flex items-center gap-3 text-sm py-1">
              <kbd className="bg-white/10 px-2.5 py-1 rounded text-xs font-mono min-w-[80px] text-center">{k}</kbd>
              <span className="text-secondary">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
