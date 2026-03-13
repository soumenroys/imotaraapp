// src/components/imotara/SkeletonLoader.tsx
"use client";

type Props = {
  rows?: number;
  variant?: "card" | "list" | "text";
};

export default function SkeletonLoader({ rows = 3, variant = "card" }: Props) {
  if (variant === "text") {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="skeleton h-4 rounded"
            style={{ width: `${75 + ((i * 17) % 25)}%`, opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-4">
            <div className="skeleton h-9 w-9 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-2/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // card (default)
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/8 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton h-8 w-8 rounded-xl" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="skeleton ml-auto h-4 w-16 rounded-full" />
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-3 w-3/5 rounded" />
        </div>
      ))}
    </div>
  );
}
