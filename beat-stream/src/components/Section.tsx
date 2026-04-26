"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

export function Section({ title, subtitle, href, children }: { title: string; subtitle?: string; href?: string; children: ReactNode }) {
  return (
    <section className="mb-10 fade-in">
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-xs font-bold text-secondary hover:text-white uppercase tracking-wider flex items-center gap-1 group">
            Show all <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
          </Link>
        )}
      </div>
      <div className="h-scroll no-scrollbar">{children}</div>
    </section>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-40 sm:w-44 md:w-48 premium-card pointer-events-none">
          <div className="aspect-square skeleton rounded-md" />
          <div className="h-3 skeleton rounded mt-3 w-3/4" />
          <div className="h-2.5 skeleton rounded mt-2 w-1/2" />
        </div>
      ))}
    </>
  );
}
