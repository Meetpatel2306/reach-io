"use client";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { achievements } from "@/lib/storage";
import { useEffect, useState } from "react";

export function AchievementsCard() {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  useEffect(() => { setUnlocked(achievements.unlocked()); }, []);
  if (!unlocked.length) return null;
  return (
    <section className="mb-10 fade-in">
      <h2 className="section-title mb-3 px-1">Achievements <span className="text-sm font-normal text-secondary">{unlocked.length}/{ACHIEVEMENTS.length}</span></h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.includes(a.id);
          return (
            <div key={a.id}
              className={`bg-card rounded-xl p-4 text-center transition ${got ? "" : "opacity-30"}`}
              title={a.description}>
              <div className="text-3xl mb-1">{a.emoji}</div>
              <div className="text-xs font-bold">{a.name}</div>
              <div className="text-[10px] text-secondary mt-0.5 line-clamp-2">{a.description}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
