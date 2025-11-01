"use client";
import React from "react";
import { cn } from "@/lib/utils"; // if you have a cn helper; otherwise replace with template strings

type Props = {
  emotions: string[];
  sentiment: "positive" | "neutral" | "negative";
  confidence?: number;
  className?: string;
};

const sentimentColor: Record<Props["sentiment"], string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800/60",
  neutral: "bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:ring-zinc-700",
  negative: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800/60",
};

export default function EmotionTags({ emotions, sentiment, confidence, className }: Props) {
  const items = emotions.length ? emotions : ["unlabeled"];
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${sentimentColor[sentiment]}`}>
        sentiment: {sentiment}{typeof confidence === "number" ? ` · ${Math.round(confidence * 100)}%` : ""}
      </span>
      {items.map((e) => (
        <span
          key={e}
          className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"
        >
          {e}
        </span>
      ))}
    </div>
  );
}
