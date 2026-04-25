'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getTheme } from '@/lib/themes';

function generateIconDataURL(size: number, color1: string, color2: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const r = size * 0.234;

  // Rounded rect with gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);

  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r); ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size); ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r); ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Lightning bolt
  ctx.fillStyle = 'white';
  ctx.beginPath();
  const s = size;
  ctx.moveTo(s * 0.5625, s * 0.14);
  ctx.lineTo(s * 0.30, s * 0.52);
  ctx.lineTo(s * 0.46, s * 0.52);
  ctx.lineTo(s * 0.38, s * 0.86);
  ctx.lineTo(s * 0.70, s * 0.44);
  ctx.lineTo(s * 0.54, s * 0.44);
  ctx.lineTo(s * 0.5625, s * 0.14);
  ctx.closePath();
  ctx.fill();

  return canvas.toDataURL('image/png');
}

export function useDynamicIcon() {
  const colorTheme = useStore((s) => s.settings.colorTheme);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const theme = getTheme(colorTheme || 'violet');
    const primary = theme.colors.primary;
    const light = theme.colors.primaryLight;

    // Generate favicon only (don't touch manifest — Chrome needs the static one for install)
    const icon = generateIconDataURL(64, light, primary);
    if (!icon) return;

    // Update favicon
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = icon;

    // Update theme-color meta
    const themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (themeMeta) {
      themeMeta.content = primary;
    }

  }, [colorTheme]);
}
