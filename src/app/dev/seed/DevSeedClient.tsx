"use client";

import { useState } from "react";
import type { Emotion } from "@/types/history";
import { saveSample, getHistory } from "@/lib/imotara/history";

export default function SeedHistoryPage() {
    const [status, setStatus] = useState<string | null>(null);
    const [count, setCount] = useState<number | null>(null);

    async function createSample() {
        setStatus("Creating…");
        const now = Date.now();

        await saveSample({
            id: `demo-${now}`, // deterministic id, no uuid needed
            message: "First demo entry",
            emotion: "neutral" as Emotion,
            intensity: 0.3,
        });

        const all = await getHistory();
        setCount(all.length);
        setStatus("Done. You can now try /dev/choices.");
    }

    return (
        <main className="mx-auto max-w-xl p-6 text-zinc-900 dark:text-zinc-100">
            <h1 className="text-2xl font-semibold">Seed a Sample Record</h1>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Click the button below to create one demo <code>EmotionRecord</code> in your local history.
                Then visit <code>/dev/choices</code> to test Choice pills.
            </p>
            <button
                onClick={createSample}
                className="mt-6 rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
                Create sample record
            </button>
            {status && (
                <p className="mt-4 text-sm">
                    {status} {count !== null && <>(<strong>{count}</strong> total)</>}
                </p>
            )}
        </main>
    );
}
