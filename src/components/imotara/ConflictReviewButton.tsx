// src/components/imotara/ConflictReviewButton.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import ConflictReviewModal from "./ConflictReviewModal";
import { getConflictQueue } from "@/lib/imotara/syncHistory";

export default function ConflictReviewButton() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  // Poll the conflict queue count every 1.5 s (client-only)
  useEffect(() => {
    function refresh() {
      try {
        const queue = getConflictQueue();
        const pending = Array.isArray(queue) ? queue.length : 0;
        setCount(pending);
      } catch {
        // ignore — localStorage / window may be unavailable in SSR
      }
    }

    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  function handleClick() {
    if (count <= 0) {
      // Avoid the “nothing happens” feeling when there are no conflicts
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
        className={[
          "relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
          hasConflicts
            ? "border-amber-600/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            : "border-zinc-600/40 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60",
        ].join(" ")}
        title={
          hasConflicts
            ? "Review sync conflicts"
            : "No sync conflicts to review"
        }
      >
        <AlertTriangle className="h-4 w-4" />
        Conflicts
        <span
          className={[
            "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            hasConflicts
              ? "bg-amber-400 text-amber-900"
              : "bg-zinc-700 text-zinc-300",
          ].join(" ")}
        >
          {count}
        </span>
      </button>

      {/* Modal still shows full conflict list when open */}
      <ConflictReviewModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
