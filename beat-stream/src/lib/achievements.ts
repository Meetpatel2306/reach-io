// Achievement definitions + check function. Call `checkAchievements()` after
// each play; any newly-unlocked badge is returned so the player can toast it.

import { counts, liked, history, listenTime, achievements, savedAlbums, followedArtists } from "./storage";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  test: () => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-play",    name: "First Play",     description: "Played your first song",          emoji: "🎵", test: () => Object.values(counts.all()).reduce((a, b) => a + b, 0) >= 1 },
  { id: "ten-plays",     name: "Ten Songs",      description: "Played 10 songs total",           emoji: "🎶", test: () => Object.values(counts.all()).reduce((a, b) => a + b, 0) >= 10 },
  { id: "hundred-plays", name: "Century",        description: "Played 100 songs total",          emoji: "💯", test: () => Object.values(counts.all()).reduce((a, b) => a + b, 0) >= 100 },
  { id: "thousand-plays",name: "Music Lover",    description: "Played 1,000 songs total",        emoji: "🌟", test: () => Object.values(counts.all()).reduce((a, b) => a + b, 0) >= 1000 },
  { id: "first-like",    name: "Heart On",       description: "Liked your first song",           emoji: "❤️", test: () => liked.list().length >= 1 },
  { id: "fifty-likes",   name: "Curator",        description: "Liked 50 songs",                  emoji: "💝", test: () => liked.list().length >= 50 },
  { id: "first-hour",    name: "First Hour",     description: "Listened for 1 hour total",       emoji: "⏰", test: () => listenTime.get() >= 3600 },
  { id: "ten-hours",     name: "Ten Hours",      description: "Listened for 10 hours total",     emoji: "🕙", test: () => listenTime.get() >= 36000 },
  { id: "hundred-hours", name: "Audiophile",     description: "Listened for 100 hours total",    emoji: "🏆", test: () => listenTime.get() >= 360000 },
  { id: "ten-artists",   name: "Explorer",       description: "Played 10 different artists",     emoji: "🗺️", test: () => uniqueArtistCount() >= 10 },
  { id: "fifty-artists", name: "Discoverer",     description: "Played 50 different artists",     emoji: "🔭", test: () => uniqueArtistCount() >= 50 },
  { id: "follow-five",   name: "Fan Club",       description: "Followed 5 artists",              emoji: "🤝", test: () => followedArtists.list().length >= 5 },
  { id: "save-ten-albums", name: "Album Collector", description: "Saved 10 albums",              emoji: "📚", test: () => savedAlbums.list().length >= 10 },
  { id: "night-owl",     name: "Night Owl",      description: "Played music between 1am and 5am", emoji: "🦉", test: () => history.list().some((e) => { const h = new Date(e.timestamp).getHours(); return h >= 1 && h < 5; }) },
  { id: "early-bird",    name: "Early Bird",     description: "Played music before 7am",         emoji: "🌅", test: () => history.list().some((e) => new Date(e.timestamp).getHours() < 7) },
];

function uniqueArtistCount(): number {
  const cache = (typeof window !== "undefined" ? require("./storage").songCache.all() : {}) as Record<string, any>;
  const set = new Set<string>();
  Object.keys(counts.all()).forEach((id) => {
    const a = cache[id]?.artists?.primary?.[0]?.id;
    if (a) set.add(a);
  });
  return set.size;
}

/** Run after each play. Returns the newly-unlocked achievements (often empty). */
export function checkAchievements(): Achievement[] {
  const unlocked: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (achievements.has(a.id)) continue;
    try {
      if (a.test()) {
        achievements.unlock(a.id);
        unlocked.push(a);
      }
    } catch {}
  }
  return unlocked;
}
