import type { Song, ImageRef, DownloadUrl, Quality } from "./types";

export function cls(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

export function fmtTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtDuration(seconds: number | string | undefined): string {
  if (seconds == null) return "";
  const n = typeof seconds === "string" ? parseInt(seconds, 10) : seconds;
  if (!isFinite(n)) return "";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min ${s}s`;
}

export function pickImage(image: ImageRef[] | string | undefined, prefer: "low" | "med" | "high" = "high"): string {
  if (!image) return "/icon-512.svg";
  if (typeof image === "string") return image;
  if (!image.length) return "/icon-512.svg";
  const order = prefer === "high" ? ["500x500", "high", "150x150", "medium", "50x50", "low"] :
                prefer === "med"  ? ["150x150", "medium", "500x500", "high"] :
                ["50x50", "low", "150x150", "medium"];
  for (const q of order) {
    const found = image.find((i) => i.quality === q);
    if (found) return decodeURI(found.url);
  }
  return decodeURI(image[image.length - 1].url);
}

export function pickDownloadUrl(song: Song, quality: Quality): string | null {
  if (!song.downloadUrl?.length) return null;
  // Prefer exact match
  const exact = song.downloadUrl.find((d) => d.quality === quality);
  if (exact) return exact.url;
  // Highest-to-lowest preference list. Try the requested quality and below first
  // (so a user choosing 96k doesn't suddenly stream 320k), then go up if nothing
  // lower exists.
  const order: Quality[] = ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"];
  const desiredIdx = order.indexOf(quality);
  for (let i = desiredIdx; i < order.length; i++) {
    const m = song.downloadUrl.find((d) => d.quality === order[i]);
    if (m) return m.url;
  }
  for (let i = desiredIdx - 1; i >= 0; i--) {
    const m = song.downloadUrl.find((d) => d.quality === order[i]);
    if (m) return m.url;
  }
  return song.downloadUrl[song.downloadUrl.length - 1].url;
}

export function artistsName(song: Song | undefined): string {
  if (!song?.artists) return "";
  const primary = song.artists.primary || song.artists.all || [];
  return primary.map((a) => a.name).join(", ");
}

export function decodeHtml(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
