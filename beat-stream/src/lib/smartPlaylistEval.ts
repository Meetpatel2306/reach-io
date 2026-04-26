// Evaluate a SmartPlaylist's rules against the song cache, returning matching
// songs. Runs entirely on the client; no API calls.

import type { Song } from "./types";
import { songCache, counts, liked, ratings, tags, type SmartPlaylist, type SmartPlaylistRule } from "./storage";

function fieldValue(song: Song, rule: SmartPlaylistRule): string | number | boolean {
  switch (rule.field) {
    case "language": return (song.language || "").toLowerCase();
    case "artist": return (song.artists?.primary || []).map((a) => a.name.toLowerCase()).join("|");
    case "year": return Number(song.year || 0);
    case "plays": return counts.get(song.id);
    case "liked": return liked.has(song.id);
    case "duration": return typeof song.duration === "string" ? parseInt(song.duration, 10) : (song.duration || 0);
    case "rating": return ratings.get(song.id);
    case "tag": return tags.get(song.id).join("|").toLowerCase();
  }
}

function matches(song: Song, rule: SmartPlaylistRule): boolean {
  const lhs = fieldValue(song, rule);
  const rhs = rule.value;
  switch (rule.op) {
    case "is": return String(lhs).toLowerCase() === String(rhs).toLowerCase();
    case "isNot": return String(lhs).toLowerCase() !== String(rhs).toLowerCase();
    case "contains": return String(lhs).toLowerCase().includes(String(rhs).toLowerCase());
    case "gt": return Number(lhs) > Number(rhs);
    case "lt": return Number(lhs) < Number(rhs);
    case "gte": return Number(lhs) >= Number(rhs);
    case "lte": return Number(lhs) <= Number(rhs);
  }
}

export function evaluateSmartPlaylist(p: SmartPlaylist): Song[] {
  const all = Object.values(songCache.all());
  return all.filter((song) => {
    if (!song?.id) return false;
    const tests = p.rules.map((r) => matches(song, r));
    return p.combine === "and" ? tests.every(Boolean) : tests.some(Boolean);
  });
}

export const RULE_FIELDS: { value: SmartPlaylistRule["field"]; label: string; type: "text" | "number" | "boolean" }[] = [
  { value: "language", label: "Language", type: "text" },
  { value: "artist", label: "Artist", type: "text" },
  { value: "year", label: "Year", type: "number" },
  { value: "plays", label: "Play count", type: "number" },
  { value: "liked", label: "Liked", type: "boolean" },
  { value: "duration", label: "Duration (s)", type: "number" },
  { value: "rating", label: "Rating", type: "number" },
  { value: "tag", label: "Tag", type: "text" },
];

export const RULE_OPS_TEXT: SmartPlaylistRule["op"][] = ["is", "isNot", "contains"];
export const RULE_OPS_NUMBER: SmartPlaylistRule["op"][] = ["gt", "gte", "lt", "lte", "is"];
export const RULE_OPS_BOOL: SmartPlaylistRule["op"][] = ["is"];
