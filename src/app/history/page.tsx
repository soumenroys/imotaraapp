// src/app/history/page.tsx
'use client';

import EmotionHistory from "@/components/imotara/EmotionHistory";

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Emotion History</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Auto-sync pulls remote updates periodically. Use the button to force a sync.
        </p>
      </header>

      <EmotionHistory />
    </main>
  );
}
