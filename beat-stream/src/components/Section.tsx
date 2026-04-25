"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

export function Section({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3 px-1">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-secondary hover:text-white flex items-center gap-1">
            Show all <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <div className="h-scroll no-scrollbar pb-2">{children}</div>
    </section>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-40 sm:w-44 md:w-48">
          <div className="aspect-square skeleton rounded-md" />
          <div className="h-3 skeleton rounded mt-3 w-3/4" />
          <div className="h-3 skeleton rounded mt-2 w-1/2" />
        </div>
      ))}
    </>
  );
}
