"use client";
import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { dailyGoal, history, listenTime } from "@/lib/storage";

export function GoalRing() {
  const [minutesToday, setMinutesToday] = useState(0);
  const [goal, setGoal] = useState(30);

  useEffect(() => {
    setGoal(dailyGoal.get());
    // Approx today's listen time = sum of song durations played today.
    // We don't track per-day listen seconds, so we estimate via plays today × 200s avg.
    // For a rougher but real number, use history entries from today and sum.
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const playsToday = history.list().filter((e) => {
      const d = new Date(e.timestamp);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
    }).length;
    // Use total listenTime as a sanity floor and assume avg 3.5 min/play
    const estMinutes = Math.min(playsToday * 3.5, listenTime.get() / 60);
    setMinutesToday(Math.round(estMinutes));
  }, []);

  const pct = Math.min(100, (minutesToday / goal) * 100);
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="bg-card rounded-2xl p-4 flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96" className="flex-shrink-0">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke="var(--accent)" strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 48 48)" style={{ transition: "stroke-dashoffset 0.6s var(--ease-out-quint)" }}
        />
        <text x="48" y="52" textAnchor="middle" fill="white" fontSize="20" fontWeight="800">{Math.round(pct)}%</text>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-widest text-accent font-bold flex items-center gap-1"><Target className="w-3 h-3" /> Daily goal</div>
        <div className="font-bold text-lg mt-0.5">{minutesToday} / {goal} min</div>
        <div className="text-xs text-secondary">
          {pct >= 100 ? "🎉 Crushed it today" : `${goal - minutesToday} min to go`}
        </div>
      </div>
    </div>
  );
}
