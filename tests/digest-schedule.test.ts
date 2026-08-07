import { describe, it, expect } from "vitest";
import { istNow, digestMinutes, type DailyDigest } from "../src/lib/settings";

// The scheduler ticks every 30 minutes and this logic decides whether a tick
// should actually send. Two rules carry the behaviour:
//   1. fire at the chosen time OR any later tick that day, so a delayed or
//      missed tick still delivers instead of silently skipping a day
//   2. changing the time clears lastSentDate, so a new time set later the same
//      day still sends today — and every day after

const cfg = (over: Partial<DailyDigest> = {}): DailyDigest => ({
  enabled: true, hourIst: 9, minuteIst: 0, lastSentDate: "", ...over,
});

// Mirrors the guard in /api/cron/daily-jobs.
function shouldSend(d: DailyDigest, nowIstMinutes: number, todayIst: string): boolean {
  if (!d.enabled) return false;
  if (d.lastSentDate === todayIst) return false;
  return nowIstMinutes >= digestMinutes(d);
}

const at = (h: number, m = 0) => h * 60 + m;
const TODAY = "2026-08-08";

describe("istNow", () => {
  it("converts UTC to IST (+5:30)", () => {
    // 03:30 UTC is 09:00 IST the same day.
    const r = istNow(new Date("2026-08-08T03:30:00Z"));
    expect(r.hour).toBe(9);
    expect(r.minutes).toBe(at(9, 0));
    expect(r.date).toBe("2026-08-08");
  });

  it("rolls the IST date forward late in the UTC day", () => {
    // 20:00 UTC on the 8th is 01:30 IST on the 9th — the once-per-day guard
    // must key off the IST date, not the UTC one.
    const r = istNow(new Date("2026-08-08T20:00:00Z"));
    expect(r.date).toBe("2026-08-09");
    expect(r.minutes).toBe(at(1, 30));
  });
});

describe("digest scheduling", () => {
  it("does not send before the chosen time", () => {
    expect(shouldSend(cfg({ hourIst: 9 }), at(8, 30), TODAY)).toBe(false);
  });

  it("sends at the chosen time", () => {
    expect(shouldSend(cfg({ hourIst: 9 }), at(9, 0), TODAY)).toBe(true);
  });

  it("honours half-past times", () => {
    const d = cfg({ hourIst: 6, minuteIst: 30 });
    expect(shouldSend(d, at(6, 0), TODAY)).toBe(false);
    expect(shouldSend(d, at(6, 30), TODAY)).toBe(true);
  });

  it("still sends on a later tick when one is missed", () => {
    // Scheduled 9:00 but the 9:00 tick never arrived — 11:00 must deliver.
    expect(shouldSend(cfg({ hourIst: 9 }), at(11, 0), TODAY)).toBe(true);
  });

  it("sends only once per day", () => {
    const sent = cfg({ hourIst: 9, lastSentDate: TODAY });
    expect(shouldSend(sent, at(9, 0), TODAY)).toBe(false);
    expect(shouldSend(sent, at(17, 0), TODAY)).toBe(false);
    // ...but resumes the next day.
    expect(shouldSend(sent, at(9, 0), "2026-08-09")).toBe(true);
  });

  it("sends again today when the time is moved later after a send", () => {
    // The 6:30 AM digest already went out, then the time is changed to 5:00 PM.
    // saveDailyDigest clears lastSentDate on a time change, so today's 5:00 PM
    // send still happens — and tomorrow's too.
    const afterChange = cfg({ hourIst: 17, minuteIst: 0, lastSentDate: "" });
    expect(shouldSend(afterChange, at(17, 0), TODAY)).toBe(true);
    expect(shouldSend(afterChange, at(17, 0), "2026-08-09")).toBe(true);
  });

  it("sends promptly when the time is moved to an hour already past", () => {
    // Changed at 3 PM from 5 PM to 6:30 AM: that time has passed today, so the
    // very next tick delivers rather than waiting until tomorrow.
    const moved = cfg({ hourIst: 6, minuteIst: 30, lastSentDate: "" });
    expect(shouldSend(moved, at(15, 0), TODAY)).toBe(true);
  });

  it("never sends while disabled", () => {
    expect(shouldSend(cfg({ enabled: false }), at(23, 30), TODAY)).toBe(false);
  });
});
