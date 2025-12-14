"use client";

import { useEffect, useState } from "react";
import { saveSample, getHistory } from "@/lib/imotara/history";

export default function StorageCheck() {
    const [message, setMessage] = useState("Running check…");
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            try {
                // step 1: create one record
                const rec = await saveSample({
                    message: "storage check",
                    emotion: "neutral",
                    intensity: 0.2,
                });
                console.log("Saved record:", rec);

                // step 2: read back from localStorage
                const all = await getHistory();
                console.log("Read back:", all);

                setCount(all.length);
                setMessage("LocalStorage read/write succeeded.");
            } catch (e) {
                console.error(e);
                setMessage("Error accessing localStorage.");
            }
        })();
    }, []);

    return (
        <main className="mx-auto max-w-xl p-6 text-zinc-900 dark:text-zinc-100">
            <h1 className="text-2xl font-semibold">Storage Check</h1>
            <p className="mt-3 text-sm">{message}</p>
            {count !== null && (
                <p className="mt-3 text-sm">
                    Records found in localStorage:{" "}
                    <span className="font-semibold">{count}</span>
                </p>
            )}
            <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
                You can also open your browser console (F12 → Application → Local Storage) and
                inspect the key <code>imotara:history:v1</code>.
            </p>
        </main>
    );
}
