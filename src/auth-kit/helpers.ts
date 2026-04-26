// Pure helpers used by AdminPage internally and re-exported so consuming apps
// can build matching custom tabs that look at home next to the built-in
// Profiles tab.

import type { UserProfile } from "./types";

/** "12m ago", "3h ago", "2d ago", or a localized date for older events. */
export function fmtRel(ts: number | undefined | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** "2h 15m" or "45m". Returns "—" for falsy / non-finite input. */
export function fmtDuration(sec: number | undefined | null): string {
  if (!sec || !isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Profiles → CSV string, with optional extra columns that compute their
 * value from the profile.
 */
export function profilesToCsv(
  rows: UserProfile[],
  extras: { label: string; render: (p: UserProfile) => string }[] = [],
): string {
  const escape = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = [
    "id", "email", "displayName", "isAdmin", "createdAt", "lastLogin",
    "totalPlays", "totalListenSeconds", "topArtist", "topSong", "topLanguage",
    ...extras.map((e) => e.label),
  ];
  const lines = [headers.join(",")];
  for (const p of rows) {
    const base = [
      p.id, p.email, p.displayName, p.isAdmin,
      new Date(p.createdAt).toISOString(),
      new Date(p.lastLogin).toISOString(),
      p.totalPlays ?? "", p.totalListenSeconds ?? "",
      p.topArtist ?? "", p.topSong ?? "", p.topLanguage ?? "",
    ];
    const xtra = extras.map((e) => e.render(p));
    lines.push([...base, ...xtra].map(escape).join(","));
  }
  return lines.join("\n");
}

/** Convenience: trigger a CSV download in the browser. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
