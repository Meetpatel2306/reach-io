"use client";
import { Star } from "lucide-react";
import { useState } from "react";

export function StarRating({ value, onChange, size = 16 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onClick={(e) => { e.stopPropagation(); onChange(n === value ? 0 : n); }}
          className="hover:scale-110 transition"
          aria-label={`${n} stars`}
        >
          <Star
            className={n <= display ? "fill-yellow-400 text-yellow-400" : "text-secondary"}
            style={{ width: size, height: size }}
          />
        </button>
      ))}
    </div>
  );
}
