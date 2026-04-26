"use client";
import { useRef, useState, useEffect } from "react";

/**
 * Spotify-style seek bar with three stacked fills inside the same track:
 *   • rail        — empty background
 *   • buffered    — lighter color, shows downloaded but unplayed range
 *   • played      — accent color, shows current position
 * + draggable thumb (visible only on hover/touch)
 */
export function Seekbar({
  progress,
  buffered,
  duration,
  onSeek,
  thumbAlwaysVisible = false,
  height = 4,
}: {
  progress: number;          // 0-100 (currentTime / duration * 100)
  buffered: number;          // 0-1 ratio of duration that's buffered
  duration: number;          // seconds (for click-to-seek calc)
  onSeek: (pct: number) => void;
  thumbAlwaysVisible?: boolean;
  height?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [dragPct, setDragPct] = useState<number | null>(null);

  const playedPct = dragPct != null ? dragPct : Math.max(0, Math.min(100, progress));
  const bufferedPct = Math.max(playedPct, Math.min(100, buffered * 100));

  function pctFromEvent(clientX: number): number {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
  }

  function startDrag(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pct = pctFromEvent(e.clientX);
    setDragPct(pct);
  }
  function moveDrag(e: React.PointerEvent) {
    if (dragPct == null) return;
    setDragPct(pctFromEvent(e.clientX));
  }
  function endDrag(e: React.PointerEvent) {
    if (dragPct == null) return;
    const pct = pctFromEvent(e.clientX);
    onSeek(pct);
    setDragPct(null);
  }
  function onClick(e: React.MouseEvent) {
    if (dragPct != null) return; // drag already handled
    onSeek(pctFromEvent(e.clientX));
  }

  return (
    <div
      ref={trackRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={onClick}
      className="relative w-full cursor-pointer group select-none"
      style={{ height: 16, touchAction: "none" }}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(playedPct)}
    >
      {/* Track */}
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full bg-white/15 overflow-hidden transition-[height]"
        style={{ height: hover || thumbAlwaysVisible ? height + 2 : height }}
      >
        {/* Buffered (lighter) */}
        <div
          className="absolute top-0 left-0 h-full bg-white/30 rounded-full transition-[width] duration-200"
          style={{ width: `${bufferedPct}%` }}
        />
        {/* Played (accent) */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-[width] duration-100 ${hover ? "bg-accent" : "bg-white"}`}
          style={{ width: `${playedPct}%` }}
        />
      </div>
      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg transition-opacity"
        style={{
          left: `${playedPct}%`,
          opacity: hover || dragPct != null || thumbAlwaysVisible ? 1 : 0,
        }}
      />
    </div>
  );
}
