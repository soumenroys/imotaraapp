// src/components/imotara/ConflictReviewButton.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import ConflictReviewModal from "./ConflictReviewModal";
import { getPendingConflicts } from "@/lib/imotara/conflictsStore";

export default function ConflictReviewButton() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  // Poll the pending-conflict count every 1.5 s (client-only)
  useEffect(() => {
    function refresh() {
      try {
        const pending = getPendingConflicts().filter((c) => !c.resolution).length;
        setCount(pending);
      } catch {
        // ignore — localStorage unavailable in SSR
      }
    }
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center gap-2 rounded-xl border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
        title="Review sync conflicts"
      >
        <AlertTriangle className="h-4 w-4" />
        Conflicts
        <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
          {count}
        </span>
      </button>
      <ConflictReviewModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
