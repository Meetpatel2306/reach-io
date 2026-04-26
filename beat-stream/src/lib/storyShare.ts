// Generate a Spotify-style "share story" image of a song using a 2D canvas.
//
// Returns a Blob (PNG). Caller can:
//   • download it       → URL.createObjectURL(blob) + <a download>
//   • share it natively → navigator.share({ files: [new File([blob], ...)] })
//   • copy to clipboard → navigator.clipboard.write([new ClipboardItem(...)])

import type { Song } from "./types";
import { artistsName, decodeHtml, pickImage } from "./utils";
import { extractDominantColor } from "./colorExtract";

interface Opts {
  song: Song;
  width?: number;
  height?: number;
  watermark?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

export async function buildStoryImage({ song, width = 1080, height = 1920, watermark = "BeatStream" }: Opts): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Background gradient from dominant album-art color to deep black
  const artUrl = pickImage(song.image, "high");
  const dom = await extractDominantColor(artUrl).catch(() => "#1f1f1f");
  const grd = ctx.createLinearGradient(0, 0, 0, height);
  grd.addColorStop(0, dom);
  grd.addColorStop(1, "#050505");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

  // Subtle noise / vignette for depth
  const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, height * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  // Album art (large, centered)
  try {
    const img = await loadImage(artUrl);
    const artSize = Math.min(width * 0.78, height * 0.48);
    const artX = (width - artSize) / 2;
    const artY = height * 0.18;
    // Soft shadow under art
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 80;
    ctx.shadowOffsetY = 30;
    drawRoundedImage(ctx, img, artX, artY, artSize, artSize, 32);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  } catch {}

  // Title
  const title = decodeHtml(song.name);
  const subtitle = decodeHtml(artistsName(song));

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `800 ${Math.round(width * 0.072)}px "Inter", system-ui, sans-serif`;
  wrapText(ctx, title, width / 2, height * 0.72, width * 0.86, Math.round(width * 0.085), 2);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `500 ${Math.round(width * 0.038)}px "Inter", system-ui, sans-serif`;
  wrapText(ctx, subtitle, width / 2, height * 0.86, width * 0.86, Math.round(width * 0.05), 1);

  // Watermark — corner badge
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `700 ${Math.round(width * 0.028)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = "left";
  // Tiny "play" icon (triangle)
  ctx.beginPath();
  const wmX = width * 0.06;
  const wmY = height * 0.94;
  ctx.fillStyle = "#1ed760";
  ctx.moveTo(wmX, wmY);
  ctx.lineTo(wmX + 22, wmY + 12);
  ctx.lineTo(wmX, wmY + 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(watermark, wmX + 32, wmY + 4);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 0.95));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines = lines.slice(0, maxLines);
  // Truncate last line with ellipsis if needed
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 1) last = last.slice(0, -1);
    if (last !== lines[maxLines - 1]) lines[maxLines - 1] = last + "…";
  }
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
}

export async function shareStoryImage(song: Song) {
  const blob = await buildStoryImage({ song });
  const file = new File([blob], `${song.name.replace(/[^\w\s-]/g, "").trim()}.png`, { type: "image/png" });
  const data: ShareData = {
    title: song.name,
    text: `${decodeHtml(song.name)} — ${decodeHtml(artistsName(song))}`,
    files: [file],
  };
  if (navigator.canShare?.(data)) {
    await navigator.share(data);
    return;
  }
  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
