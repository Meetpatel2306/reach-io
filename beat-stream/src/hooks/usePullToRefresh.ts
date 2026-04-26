"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh: drag down from the top of a scrollable container to trigger
 * `onRefresh`. Returns the live pull distance and a "ready" flag for UI.
 *
 * Attach the returned `bind` to the scrollable wrapper. Visible only on touch.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, threshold = 80) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 0 || refreshing) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPull(0); return; }
      // Damped pull
      setPull(Math.min(threshold * 1.5, dy * 0.5));
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pull >= threshold && !refreshing) {
        setRefreshing(true);
        try { await onRefresh(); } catch {}
        setRefreshing(false);
      }
      setPull(0);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [pull, refreshing, onRefresh, threshold]);

  return { pull, refreshing, ref: containerRef, ready: pull >= threshold };
}
