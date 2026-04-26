"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Song } from "@/lib/types";
import { api } from "@/lib/api";
import { cached, TTL } from "@/lib/cache";
import { parseLrc, activeLineIndex, isSyncedLrc, type LrcLine } from "@/lib/lrcParse";
import { usePlayer } from "@/contexts/PlayerContext";

interface LyricsBundle {
  plain: string | null;
  synced: string | null;
}

/**
 * Compact lyrics card sized to sit beneath/beside the album art rather than
 * taking over the whole player. Internally it's still a fully-scrollable
 * lyrics list with active-line highlight + auto-scroll — just constrained to
 * a small fixed height (~h-44) so the album art stays the focal point.
 */
export function LyricsPanel({ song }: { song: Song }) {
  const { currentTime, seekTo } = usePlayer();
  const [bundle, setBundle] = useState<LyricsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBundle(null);
    cached(
      `lyrics-synced:${song.id}`,
      TTL.lyrics,
      () => api.getSyncedLyricsForSong(song),
    ).then((b) => {
      if (!cancelled) {
        setBundle(b);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [song.id]);

  const synced: LrcLine[] = useMemo(() => {
    if (!bundle?.synced || !isSyncedLrc(bundle.synced)) return [];
    return parseLrc(bundle.synced);
  }, [bundle?.synced]);

  return (
    <div className="w-full max-w-md bg-black/40 backdrop-blur-sm rounded-xl px-4 py-3">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : synced.length > 0 ? (
        <SyncedLyrics lines={synced} currentTime={currentTime} onSeek={seekTo} />
      ) : bundle?.plain ? (
        <PlainLyrics text={bundle.plain} />
      ) : (
        <div className="text-center text-secondary text-sm py-6">
          Lyrics not available
        </div>
      )}
    </div>
  );
}

function SyncedLyrics({
  lines,
  currentTime,
  onSeek,
}: {
  lines: LrcLine[];
  currentTime: number;
  onSeek: (s: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Pause auto-scroll briefly when the user manually scrolls/touches so the
  // smooth-scroll doesn't fight them.
  const userScrollRef = useRef(false);
  const userScrollTimerRef = useRef<number | null>(null);

  const activeIdx = useMemo(() => activeLineIndex(lines, currentTime), [lines, currentTime]);

  useEffect(() => {
    if (activeIdx < 0) return;
    if (userScrollRef.current) return;
    const el = lineRefs.current[activeIdx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onUser = () => {
      userScrollRef.current = true;
      if (userScrollTimerRef.current) window.clearTimeout(userScrollTimerRef.current);
      userScrollTimerRef.current = window.setTimeout(() => {
        userScrollRef.current = false;
      }, 4000);
    };
    c.addEventListener("wheel", onUser, { passive: true });
    c.addEventListener("touchstart", onUser, { passive: true });
    return () => {
      c.removeEventListener("wheel", onUser);
      c.removeEventListener("touchstart", onUser);
      if (userScrollTimerRef.current) window.clearTimeout(userScrollTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-44 overflow-y-auto py-16 select-none text-center scrollbar-thin"
    >
      {lines.map((line, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        const empty = !line.text;
        return (
          <div
            key={`${line.time}-${i}`}
            ref={(el) => { lineRefs.current[i] = el; }}
            onClick={() => onSeek(line.time)}
            role="button"
            tabIndex={0}
            className={[
              "py-1 px-2 rounded cursor-pointer transition-all duration-300 leading-snug",
              empty ? "h-2" : "",
              isActive
                ? "text-white font-semibold text-base"
                : isPast
                  ? "text-white/30 text-sm"
                  : "text-white/55 text-sm hover:text-white/80",
            ].join(" ")}
          >
            {line.text || "♪"}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Plain (non-synced) lyrics inside the same compact box. Scrollable so users
 * can read the whole song without the panel ballooning.
 */
function PlainLyrics({ text }: { text: string }) {
  const safe = useMemo(() => text.replace(/<[^>]+>/g, ""), [text]);
  return (
    <div className="h-44 overflow-y-auto text-white/85 text-sm leading-relaxed whitespace-pre-line text-center scrollbar-thin">
      {safe}
    </div>
  );
}
