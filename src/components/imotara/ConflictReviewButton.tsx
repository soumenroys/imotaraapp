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

  return (
    <>
      <button
        onClick={handleClick}
        title={hasConflicts ? "Review sync conflicts" : "No sync conflicts"}
        className={[
          "relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all backdrop-blur-md",
          hasConflicts
            ? "border border-amber-500/50 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30"
            : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 dark:bg-zinc-900/40 dark:text-zinc-400",
        ].join(" ")}
      >
        <AlertTriangle
          className={`h-4 w-4 ${hasConflicts ? "text-amber-300" : "text-zinc-400"
            }`}
        />
        Conflicts
        <span
          className={[
            "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-md",
            hasConflicts
              ? "bg-amber-400 text-amber-900"
              : "bg-zinc-700 text-zinc-200 dark:bg-zinc-800",
          ].join(" ")}
        >
          {count}
        </span>
      </button>

      {/* Modal */}
      <ConflictReviewModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
