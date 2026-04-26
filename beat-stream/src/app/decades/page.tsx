"use client";
import Link from "next/link";
import { DECADES } from "@/lib/charts";

export default function DecadesPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 fade-in">
      <div className="hero-bg rounded-3xl mb-8 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest text-accent font-bold mb-1">Throwbacks</div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Browse by decade</h1>
          <p className="text-secondary mt-2">Step into any era of music</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {DECADES.map((d) => (
          <Link key={d.id} href={`/decades/${d.id}`}
            className={`relative aspect-square rounded-2xl bg-gradient-to-br ${d.color} p-6 overflow-hidden hover:scale-[1.04] transition shadow-xl flex items-center justify-center`}>
            <div className="text-7xl font-black drop-shadow-lg">{d.label}</div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-lg bg-white/10 rotate-12 pointer-events-none" />
          </Link>
        ))}
      </div>
    </div>
  );
}
