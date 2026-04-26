"use client";
import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

/**
 * Live audio FFT visualizer. Draws frequency-domain bars synced to playback.
 *
 * Uses a SHARED AnalyserNode hooked off the equalizer chain — we don't create
 * a second AudioContext (browsers limit them). When the equalizer hasn't been
 * attached yet (no song played), we render an idle pattern so the canvas
 * doesn't look broken.
 */
export function Visualizer({ height = 60, color = "currentColor" }: { height?: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const { isPlaying } = usePlayer();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function attachAnalyser() {
      const eq = (window as any).__bsEqualizer;
      if (!eq?.ctx || !eq.outputGain) return false;
      if (analyserRef.current) return true;
      try {
        const a = eq.ctx.createAnalyser();
        a.fftSize = 128;
        a.smoothingTimeConstant = 0.85;
        eq.outputGain.connect(a);
        analyserRef.current = a;
        return true;
      } catch { return false; }
    }

    function draw() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; ctx.scale(dpr, dpr); }
      ctx.clearRect(0, 0, w, h);

      attachAnalyser();
      const a = analyserRef.current;
      const bins = 32;
      const data = new Uint8Array(bins);
      if (a && isPlaying) {
        const arr = new Uint8Array(a.frequencyBinCount);
        a.getByteFrequencyData(arr);
        const step = Math.floor(arr.length / bins);
        for (let i = 0; i < bins; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += arr[i * step + j];
          data[i] = sum / step;
        }
      } else {
        // Idle pulse
        const t = performance.now() / 800;
        for (let i = 0; i < bins; i++) data[i] = (Math.sin(t + i * 0.4) * 0.4 + 0.5) * (isPlaying ? 60 : 20);
      }

      const barW = w / bins;
      const gap = 2;
      ctx.fillStyle = color;
      for (let i = 0; i < bins; i++) {
        const v = (data[i] / 255) * h;
        const bh = Math.max(2, v);
        ctx.fillRect(i * barW + gap / 2, h - bh, barW - gap, bh);
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, color]);

  return <canvas ref={canvasRef} style={{ width: "100%", height, display: "block" }} />;
}
