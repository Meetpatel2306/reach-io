"use client";
import Link from "next/link";
import { CHARTS } from "@/lib/charts";

export default function ChartsPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <div className="hero-bg rounded-3xl mb-8 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest text-accent font-bold mb-1">Top Charts</div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">What the world is playing</h1>
          <p className="text-secondary mt-2">Live charts updated every 6 hours</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHARTS.map((c) => (
          <Link key={c.id} href={`/charts/${c.id}`}
            className={`relative aspect-video rounded-2xl bg-gradient-to-br ${c.color} p-6 overflow-hidden hover:scale-[1.02] transition shadow-xl flex flex-col justify-between`}>
            <div className="text-5xl float">{c.emoji}</div>
            <div>
              <div className="text-xs uppercase tracking-widest font-bold opacity-80">Chart</div>
              <div className="font-extrabold text-2xl mt-1">{c.name}</div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-lg bg-white/10 rotate-12 pointer-events-none" />
          </Link>
        ))}
      </div>
    </div>
  );
}
