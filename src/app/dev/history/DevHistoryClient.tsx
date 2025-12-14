"use client";

import { useEffect, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";

export default function HistoryInspector() {
    const [list, setList] = useState<EmotionRecord[] | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await getHistory();
                setList(data ?? []);
            } catch (e) {
                console.error(e);
                setList([]);
            }
        })();
    }, []);

    return (
        <main className="mx-auto max-w-3xl p-6 text-zinc-900 dark:text-zinc-100">
            <h1 className="text-2xl font-semibold">History Inspector</h1>

            {list === null ? (
                <p className="mt-4 text-zinc-500 dark:text-zinc-400">Loading…</p>
            ) : (
                <>
                    <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                        Records found: <span className="font-semibold">{list.length}</span>
                    </p>

                    {list.length > 0 && (
                        <div className="mt-4 space-y-3">
                            {list
                                .slice()
                                .sort((a, b) => b.updatedAt - a.updatedAt)
                                .slice(0, 10)
                                .map((r) => (
                                    <div
                                        key={r.id}
                                        className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800"
                                    >
                                        <div>
                                            <span className="font-medium">id:</span> {r.id}
                                        </div>
                                        <div>
                                            <span className="font-medium">message:</span> {r.message}
                                        </div>
                                        <div>
                                            <span className="font-medium">emotion:</span> {r.emotion} •{" "}
                                            <span className="font-medium">intensity:</span> {r.intensity}
                                        </div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            createdAt: {r.createdAt} • updatedAt: {r.updatedAt}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </>
            )}
        </main>
    );
}
