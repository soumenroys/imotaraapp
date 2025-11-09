// src/components/imotara/ChoicePills.tsx
//
// Renders pill buttons for each available Choice on an EmotionRecord.
// Clicking a pill applies the choice optimistically (local-only for now).
//
// Usage idea (later in your message/card component):
//   <ChoicePills record={record} onAfterApply={(updated) => setLocalState(updated)} />
//

"use client";

import { useMemo, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import type { Choice } from "@/types/choice";
import { useApplyChoiceOptimistic } from "@/hooks/useApplyChoiceOptimistic";

type Props = {
  record: EmotionRecord;
  className?: string;
  /**
   * Optional callback: fired after a successful apply-and-save.
   * Receive the updated record so the parent can refresh UI without reloading history.
   */
  onAfterApply?: (updated: EmotionRecord) => void;
};

export default function ChoicePills({ record, className = "", onAfterApply }: Props) {
  const { applyAndSave } = useApplyChoiceOptimistic();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const choices: Choice[] = useMemo(() => record.choices ?? [], [record.choices]);
  const applied = useMemo(() => new Set(record.appliedChoices ?? []), [record.appliedChoices]);

  if (!choices.length) return null;

  async function handleApply(choice: Choice) {
    if (applied.has(choice.id)) return; // idempotent
    setErrorId(null);
    setPendingId(choice.id);
    const updated = await applyAndSave(record, choice);
    setPendingId(null);

    if (updated) {
      onAfterApply?.(updated);
    } else {
      setErrorId(choice.id);
    }
  }

  return (
    <div className={`mt-3 flex flex-wrap gap-2 ${className}`}>
      {choices.map((c) => {
        const isApplied = applied.has(c.id);
        const isPending = pendingId === c.id;
        const isError = errorId === c.id;

        return (
          <button
            key={c.id}
            type="button"
            title={c.tooltip || c.label}
            disabled={isApplied || isPending}
            onClick={() => handleApply(c)}
            className={[
              "select-none rounded-full border px-3 py-1 text-sm transition",
              "border-zinc-300 text-zinc-700 hover:bg-zinc-100",
              "dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
              isApplied ? "opacity-50 cursor-not-allowed" : "",
              isPending ? "animate-pulse opacity-70" : "",
              isError ? "ring-2 ring-red-500" : "",
            ].join(" ")}
            aria-pressed={isApplied}
            aria-busy={isPending}
          >
            {isApplied ? "✓ " : ""}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
