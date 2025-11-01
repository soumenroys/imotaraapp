"use client";
import React from "react";

type Props = {
  text: string;
};

export default function ToneReflection({ text }: Props) {
  if (!text) return null;
  return (
    <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">reflection</div>
      <p>{text}</p>
    </div>
  );
}
