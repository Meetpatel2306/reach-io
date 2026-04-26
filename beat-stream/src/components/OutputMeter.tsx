"use client";
import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

// Resolve `--accent` CSS var to an actual color string. Canvas can't parse
// `var(...)`. We refresh on every call (cheap) so accent-color changes via
// settings reflect immediately.
function getCssAccent(): string {
  if (typeof document === "undefined") return "#1ed760";
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return v || "#1ed760";
  } catch { return "#1ed760"; }
}

/**
 * Real-time audio output level meter (peak + RMS) drawn on a canvas.
 *
 * Why: browsers don't expose system/device volume to JS. The user's app
 * slider is multiplied by system volume by the OS, then sent to speakers.
 * To give the user an honest indicator of "how loud is this actually," we
 * tap the equalizer's output gain with a fresh AnalyserNode and draw the
 * peak + RMS amplitude in real time. If they crank the slider but the meter
 * stays flat, they know the issue is system volume / mute / output device.
 */
export function OutputMeter({ width = 6, height = 80, vertical = true }: { width?: number; height?: number; vertical?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const peakHoldRef = useRef(0);
  const peakHoldUntilRef = useRef(0);
  const { isPlaying } = usePlayer();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function attach() {
      const eq = (window as any).__bsEqualizer;
      if (!eq?.ctx || !eq.outputGain) return false;
      if (analyserRef.current) return true;
      try {
        const a = eq.ctx.createAnalyser();
        a.fftSize = 1024;
        a.smoothingTimeConstant = 0.4;
        eq.outputGain.connect(a);
        analyserRef.current = a;
        return true;
      } catch { return false; }
    }

    function frame() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || width;
      const h = canvas.clientHeight || height;
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, w, h);

      attach();
      const a = analyserRef.current;
      let rms = 0, peak = 0;
      if (a && isPlaying) {
        const buf = new Uint8Array(a.fftSize);
        a.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
          const av = Math.abs(v);
          if (av > peak) peak = av;
        }
        rms = Math.sqrt(sum / buf.length);
      }

      // Peak hold (200ms decay)
      const now = performance.now();
      if (peak > peakHoldRef.current) {
        peakHoldRef.current = peak;
        peakHoldUntilRef.current = now + 600;
      } else if (now > peakHoldUntilRef.current) {
        peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.02);
      }

      // Resolve --accent to an actual hex/rgb. Canvas can't parse CSS vars.
      const accent = getCssAccent();

      if (vertical) {
        const barH = h - 4;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 2, w, barH);

        const fillH = Math.min(barH, rms * barH * 2.2);
        const peakY = h - 2 - Math.min(barH, peakHoldRef.current * barH * 2.2);

        // Color shifts as level rises
        const level = peakHoldRef.current;
        ctx.fillStyle = level > 0.85 ? "#ef4444" : level > 0.6 ? "#facc15" : accent;
        ctx.fillRect(0, h - 2 - fillH, w, fillH);

        if (peakHoldRef.current > 0.02) {
          ctx.fillStyle = level > 0.85 ? "#ef4444" : level > 0.6 ? "#facc15" : "rgba(255,255,255,0.7)";
          ctx.fillRect(0, peakY, w, 2);
        }
      } else {
        const barW = w - 4;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(2, 0, barW, h);
        const fillW = Math.min(barW, rms * barW * 2.2);
        ctx.fillStyle = accent;
        ctx.fillRect(2, 0, fillW, h);
      }

      rafRef.current = requestAnimationFrame(frame);
    }
    frame();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, vertical, width, height]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} aria-hidden="true" />;
}
