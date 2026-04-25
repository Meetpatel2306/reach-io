'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

function getAccentRGB(): [number, number, number] {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#8b5cf6';
  return [
    parseInt(accent.slice(1, 3), 16) || 139,
    parseInt(accent.slice(3, 5), 16) || 92,
    parseInt(accent.slice(5, 7), 16) || 246,
  ];
}

export default function BgEffects() {
  const bgEffect = useStore((s) => s.settings.bgEffect);
  const colorTheme = useStore((s) => s.settings.colorTheme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bgEffect === 'none') {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (canvas) {
        const c = canvas.getContext('2d');
        if (c) c.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    let [r, g, b] = getAccentRGB();
    let particles: any[] = [];
    let time = 0;
    let running = true;

    const W = () => canvas.width;
    const H = () => canvas.height;

    // Initialize particles
    const initParticles = () => {
      particles = [];
      const w = W(), h = H();
      if (bgEffect === 'orbs') {
        for (let i = 0; i < 6; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, radius: 80 + Math.random() * 150, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, opacity: 0.03 + Math.random() * 0.04 });
      } else if (bgEffect === 'particles') {
        for (let i = 0; i < 60; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, radius: 1 + Math.random() * 2, vx: (Math.random() - 0.5) * 0.5, vy: -0.2 - Math.random() * 0.5, opacity: 0.2 + Math.random() * 0.5 });
      } else if (bgEffect === 'stars') {
        for (let i = 0; i < 120; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, radius: 0.5 + Math.random() * 1.5, phase: Math.random() * Math.PI * 2, speed: 0.02 + Math.random() * 0.03 });
      } else if (bgEffect === 'bubbles') {
        for (let i = 0; i < 25; i++) particles.push({ x: Math.random() * w, y: h + Math.random() * 200, radius: 5 + Math.random() * 25, vy: -0.3 - Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.3, opacity: 0.04 + Math.random() * 0.08 });
      } else if (bgEffect === 'rain') {
        for (let i = 0; i < 100; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 25, vy: 3 + Math.random() * 5, opacity: 0.04 + Math.random() * 0.08 });
      }
    };

    initParticles();

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, W(), H());
      time += 0.016;
      [r, g, b] = getAccentRGB(); // Re-read on every frame for theme changes
      const w = W(), h = H();

      if (bgEffect === 'orbs') {
        particles.forEach((p) => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -p.radius) p.x = w + p.radius;
          if (p.x > w + p.radius) p.x = -p.radius;
          if (p.y < -p.radius) p.y = h + p.radius;
          if (p.y > h + p.radius) p.y = -p.radius;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, `rgba(${r},${g},${b},${p.opacity})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        });
      }

      else if (bgEffect === 'particles') {
        particles.forEach((p) => {
          p.x += p.vx; p.y += p.vy;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10 || p.x > w + 10) p.x = Math.random() * w;
          ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        });
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              ctx.strokeStyle = `rgba(${r},${g},${b},${0.08 * (1 - dist / 120)})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
            }
          }
        }
      }

      else if (bgEffect === 'grid') {
        const spacing = 40;
        ctx.strokeStyle = `rgba(${r},${g},${b},0.04)`;
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        const gx = (time * 30) % w;
        const gy = (time * 20) % h;
        const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, 120);
        grd.addColorStop(0, `rgba(${r},${g},${b},0.12)`); grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      }

      else if (bgEffect === 'waves') {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.04 + i * 0.01})`;
          ctx.lineWidth = 1.5;
          for (let x = 0; x <= w; x += 4) {
            const y = h * 0.5 + Math.sin(x * 0.005 + time * (0.5 + i * 0.3) + i) * (60 + i * 30) + Math.sin(x * 0.01 + time) * 20;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      else if (bgEffect === 'stars') {
        particles.forEach((p) => {
          p.phase += p.speed;
          const opacity = 0.15 + Math.sin(p.phase) * 0.35;
          ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(0.02, opacity)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        });
      }

      else if (bgEffect === 'gradient-mesh') {
        for (let i = 0; i < 5; i++) {
          const cx = w * (0.15 + 0.35 * Math.sin(time * 0.25 + i * 1.3));
          const cy = h * (0.15 + 0.35 * Math.cos(time * 0.18 + i * 1.1));
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
          grd.addColorStop(0, `rgba(${r},${g},${b},0.07)`); grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
        }
      }

      else if (bgEffect === 'dots') {
        const spacing = 30;
        for (let x = spacing; x < w; x += spacing) {
          for (let y = spacing; y < h; y += spacing) {
            const dist = Math.sqrt((x - w / 2) ** 2 + (y - h / 2) ** 2);
            const pulse = Math.sin(dist * 0.008 - time * 2) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(${r},${g},${b},${0.02 + pulse * 0.05})`;
            ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      else if (bgEffect === 'aurora-bg') {
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          const baseY = h * 0.25 + i * 35;
          for (let x = 0; x <= w; x += 3) {
            const y = baseY + Math.sin(x * 0.003 + time * 0.5 + i * 0.8) * 60 + Math.sin(x * 0.007 + time * 0.3) * 30;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
          ctx.fillStyle = `rgba(${r},${g},${b},${0.018 - i * 0.002})`;
          ctx.fill();
        }
      }

      else if (bgEffect === 'rain') {
        particles.forEach((p) => {
          p.y += p.vy;
          if (p.y > h + 30) { p.y = -30; p.x = Math.random() * w; }
          ctx.strokeStyle = `rgba(${r},${g},${b},${p.opacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len); ctx.stroke();
        });
      }

      else if (bgEffect === 'glow-lines') {
        for (let i = 0; i < 8; i++) {
          const x1 = w * Math.sin(time * 0.2 + i) * 0.5 + w / 2;
          const x2 = w * Math.cos(time * 0.15 + i + 2) * 0.5 + w / 2;
          const cpx = w / 2 + Math.sin(time * 0.8 + i) * 250;
          const cpy = h / 2 + Math.cos(time * 0.6 + i) * 150;
          ctx.strokeStyle = `rgba(${r},${g},${b},0.04)`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x1, 0); ctx.quadraticCurveTo(cpx, cpy, x2, h); ctx.stroke();
        }
      }

      else if (bgEffect === 'hexagons') {
        const size = 50;
        const hh = size * Math.sqrt(3);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.035)`;
        ctx.lineWidth = 0.5;
        for (let row = -1; row < h / hh + 2; row++) {
          for (let col = -1; col < w / (size * 1.5) + 2; col++) {
            const cx = col * size * 1.5;
            const cy = row * hh + (col % 2 ? hh / 2 : 0);
            const dist = Math.sqrt((cx - w / 2) ** 2 + (cy - h / 2) ** 2);
            const pulse = Math.sin(dist * 0.004 - time * 1.5) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(${r},${g},${b},${0.02 + pulse * 0.04})`;
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
              const angle = Math.PI / 3 * s - Math.PI / 6;
              const px = cx + size * 0.4 * Math.cos(angle);
              const py = cy + size * 0.4 * Math.sin(angle);
              s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
          }
        }
      }

      else if (bgEffect === 'bubbles') {
        particles.forEach((p) => {
          p.y += p.vy;
          p.x += p.vx + Math.sin(time * 2 + p.radius) * 0.3;
          if (p.y < -p.radius * 2) { p.y = h + p.radius * 2; p.x = Math.random() * w; }
          ctx.strokeStyle = `rgba(${r},${g},${b},${p.opacity})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity * 0.3})`;
          ctx.beginPath(); ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.2, 0, Math.PI * 2); ctx.fill();
        });
      }

      else if (bgEffect === 'smoke') {
        for (let i = 0; i < 10; i++) {
          const sx = w * (0.1 + 0.1 * i) + Math.sin(time * 0.3 + i * 0.7) * 80;
          const sy = h * (0.25 + 0.12 * Math.sin(time * 0.2 + i * 0.5));
          const sr = 120 + 60 * Math.sin(time * 0.35 + i);
          const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          grd.addColorStop(0, `rgba(${r},${g},${b},0.035)`); grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }
      }

      else if (bgEffect === 'spotlight') {
        const sx = w / 2 + Math.sin(time * 0.4) * w * 0.35;
        const sy = h / 2 + Math.cos(time * 0.25) * h * 0.25;
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 350);
        grd.addColorStop(0, `rgba(${r},${g},${b},0.10)`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},0.03)`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
        // Second smaller spotlight
        const sx2 = w / 2 + Math.cos(time * 0.55) * w * 0.25;
        const sy2 = h / 2 + Math.sin(time * 0.35) * h * 0.2;
        const grd2 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, 200);
        grd2.addColorStop(0, `rgba(${r},${g},${b},0.06)`);
        grd2.addColorStop(1, 'transparent');
        ctx.fillStyle = grd2; ctx.fillRect(0, 0, w, h);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [bgEffect, colorTheme]);

  if (bgEffect === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
