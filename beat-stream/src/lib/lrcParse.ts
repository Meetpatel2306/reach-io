// Parse LRC-format lyrics into timestamped lines.
//
// LRC syntax (one line per lyric):
//   [mm:ss]Lyric line
//   [mm:ss.xx]Lyric line   (xx = hundredths of a second; some sources use ms)
//   [mm:ss][mm:ss.xx]Same line repeated at multiple times
// Metadata lines like [ar:Artist] or [ti:Title] are ignored.

export interface LrcLine {
  time: number;     // seconds
  text: string;
}

const TIMECODE_RE = /\[(\d+):(\d+)(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(raw: string): LrcLine[] {
  if (!raw) return [];
  const out: LrcLine[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    // Skip pure-metadata lines like [ar:..], [ti:..], [length:..]
    const meta = rawLine.match(/^\[(ar|ti|al|by|au|length|offset|re|ve):/i);
    if (meta) continue;

    const matches: { t: number; len: number; idx: number }[] = [];
    TIMECODE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIMECODE_RE.exec(rawLine)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      let frac = 0;
      if (m[3]) {
        const f = m[3];
        // 1-2 digits = hundredths; 3 digits = milliseconds
        if (f.length === 3) frac = parseInt(f, 10) / 1000;
        else frac = parseInt(f, 10) / Math.pow(10, f.length);
      }
      matches.push({ t: min * 60 + sec + frac, len: m[0].length, idx: m.index });
    }
    if (!matches.length) continue;

    // Text is everything after the last timecode
    const last = matches[matches.length - 1];
    const text = rawLine.slice(last.idx + last.len).trim();
    for (const tm of matches) out.push({ time: tm.t, text });
  }
  // Sort by time and dedupe identical entries
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** Find the index of the line that should currently be highlighted at `t` seconds.
 *  Returns -1 if `t` is before the first lyric. */
export function activeLineIndex(lines: LrcLine[], t: number): number {
  if (!lines.length) return -1;
  // Binary search for the largest line whose time <= t
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

/** True if the raw text contains any LRC-style timecode. */
export function isSyncedLrc(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /\[\d+:\d+(?:[.:]\d+)?\]/.test(raw);
}
