// src/components/imotara/ConflictReviewButton.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import ConflictReviewModal from "./ConflictReviewModal";
import { getConflictQueue } from "@/lib/imotara/syncHistory";

export default function ConflictReviewButton() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  // Poll conflict count every 1.5 seconds
  useEffect(() => {
    function refresh() {
      try {
        const queue = getConflictQueue();
        const pending = Array.isArray(queue) ? queue.length : 0;
        setCount(pending);
      } catch {
        /* ignore */
      }
    }

    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  function handleClick() {
    if (count <= 0) {
      if (typeof window !== "undefined") {
        window.alert("No sync conflicts to review right now.");
      }
      return;
    }
    setOpen(true);
  }

  const hasConflicts = count > 0;

  const baseButtonClasses =
    "relative inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs sm:text-sm font-medium " +
    "transition-all backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

  const variantClasses = hasConflicts
    ? // Conflicts present: slightly brighter, glowing, clearly clickable
    "border border-amber-500/60 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30 " +
    "shadow-sm shadow-amber-500/40 cursor-pointer animate-pulse-soft"
    : // No conflicts: neutral, calm
    "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 dark:bg-zinc-900/40 " +
    "dark:text-zinc-400 cursor-default";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={hasConflicts ? "Review sync conflicts" : "No sync conflicts"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${baseButtonClasses} ${variantClasses}`}
      >
        <AlertTriangle
          className={`h-4 w-4 ${hasConflicts ? "text-amber-300" : "text-zinc-400"
            }`}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">Conflicts</span>
        <span className="sm:hidden">Conf</span>

        {/* Count pill with live-updating announcement */}
        <span
          aria-live="polite"
          aria-atomic="true"
          className={[
            "ml-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5",
            "text-[10px] font-bold shadow-md tabular-nums",
            hasConflicts
              ? "bg-amber-400 text-amber-900"
              : "bg-zinc-700 text-zinc-200 dark:bg-zinc-800",
          ].join(" ")}
        >
          {count}
        </span>
      </button>

      {/* Modal (remains always mounted; visibility controlled by `open`) */}
      <ConflictReviewModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
