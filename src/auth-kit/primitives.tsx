"use client";
// Reusable presentation primitives the consuming app can compose into custom
// admin tabs. Same look-and-feel as the built-in Profiles tab.

import { ReactNode } from "react";

export function StatCard({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`bg-card rounded-xl p-4 ${accent ? "ring-1 ring-accent/40" : ""}`}>
      <Icon className="w-4 h-4 text-accent mb-2" />
      <div className="text-xs text-secondary">{label}</div>
      <div className="text-2xl font-extrabold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card rounded-xl p-4 mb-4 space-y-3">{children}</div>
  );
}

export function FilterRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function PillTabs<T extends string>({
  tabs, value, onChange,
}: { tabs: { id: T; label: string; icon?: any; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = value === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${active ? "bg-white text-black" : "bg-card text-secondary hover:text-white"}`}>
            {Icon && <Icon className="w-4 h-4" />}
            {t.label}
            {t.count != null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? "bg-black/15" : "bg-white/10"}`}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="text-center text-secondary py-12">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <div className="text-base font-semibold text-white">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}
