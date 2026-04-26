// Lightweight typo-tolerance helpers.
//
// JioSaavn search isn't fuzzy — "ed shreen" returns nothing because no song
// title or artist contains that exact substring. We can't fix the API, but
// we can:
//   1. Generate plausible spelling variants of the query and try those too
//   2. Score candidate strings by edit distance and pick the closest match
//
// This is a tiny, dependency-free implementation good enough for 1-2 char
// typos in everyday queries.

/** Levenshtein distance between two strings (capped for speed). */
export function editDistance(a: string, b: string, cap = 4): number {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    let minRow = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
      if (dp[j] < minRow) minRow = dp[j];
    }
    if (minRow > cap) return cap + 1; // early bail
  }
  return dp[b.length];
}

/** Generate spelling variants for a query token. */
function variantsForToken(t: string): string[] {
  if (t.length < 4) return [t];
  const out = new Set<string>([t]);
  // Double-letter insertions / removals (very common in name typos)
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === t[i + 1]) out.add(t.slice(0, i) + t.slice(i + 1)); // remove dup
  }
  for (let i = 0; i < t.length; i++) {
    out.add(t.slice(0, i + 1) + t[i] + t.slice(i + 1)); // insert dup
  }
  // Adjacent-key swaps (qwerty)
  const NEIGHBOURS: Record<string, string> = {
    q: "wa", w: "qeas", e: "wrsd", r: "etdf", t: "ryfg", y: "tugh", u: "yihj",
    i: "uojk", o: "ipkl", p: "ol",
    a: "qwsz", s: "awedxz", d: "serfcx", f: "drtgvc", g: "ftyhbv", h: "gyujnb",
    j: "huiknm", k: "jiolm", l: "kop",
    z: "asx", x: "zsdc", c: "xdfv", v: "cfgb", b: "vghn", n: "bhjm", m: "njk",
  };
  for (let i = 0; i < t.length; i++) {
    const ns = NEIGHBOURS[t[i]];
    if (!ns) continue;
    for (const c of ns) out.add(t.slice(0, i) + c + t.slice(i + 1));
  }
  // Vowel substitutions (ee/ea, i/y, o/u common)
  const VOWEL_SUBS: [string, string][] = [["ee", "ea"], ["ea", "ee"], ["i", "y"], ["y", "i"], ["o", "u"], ["u", "o"]];
  for (const [from, to] of VOWEL_SUBS) {
    if (t.includes(from)) out.add(t.replace(from, to));
  }
  return Array.from(out).slice(0, 8);
}

/** Generate up to 6 plausible re-spellings of a multi-word query. */
export function fuzzyVariants(query: string, max = 6): string[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  if (tokens.length === 1) return variantsForToken(tokens[0]).slice(0, max);
  // Fuzz only the longest token (usually the most distinctive one)
  const longestIdx = tokens.reduce((best, t, i) => t.length > tokens[best].length ? i : best, 0);
  const fuzzed = variantsForToken(tokens[longestIdx]);
  const out = new Set<string>();
  for (const v of fuzzed) {
    const copy = tokens.slice();
    copy[longestIdx] = v;
    out.add(copy.join(" "));
    if (out.size >= max) break;
  }
  return Array.from(out);
}
