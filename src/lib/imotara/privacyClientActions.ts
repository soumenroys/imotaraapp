// src/lib/imotara/privacyClientActions.ts
//
// Client-side helpers for privacy actions:
//  - Export history as a JSON file
//  - Delete all remote history (global tombstone)
//
// These are thin wrappers around /api/history, so they remain
// compatible with the existing sync + LWW behavior.

"use client";

import type { EmotionRecord } from "@/types/history";

/**
 * Export the full remote history (including deleted tombstones)
 * as a downloadable JSON file in the browser.
 *
 * Uses:
 *   GET /api/history?mode=array&includeDeleted=1
 *
 * This does NOT clear anything; it's read-only.
 */
export async function exportHistoryAsJsonFile(
    filename: string = "imotara-history.json"
): Promise<void> {
    const res = await fetch("/api/history?mode=array&includeDeleted=1");

    if (!res.ok) {
        throw new Error(`Failed to export history: ${res.status} ${res.statusText}`);
    }

    const records = (await res.json()) as EmotionRecord[];

    // Pretty-print JSON for easier reading by the user.
    const json = JSON.stringify(records, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Delete all remote history by applying tombstones to every known record
 * in the in-memory store.
 *
 * Uses:
 *   DELETE /api/history   (no body ⇒ "mode: all")
 *
 * This is a remote-best-effort; local history may still exist until
 * the next sync, and clients should converge via LWW semantics.
 */
export async function deleteAllRemoteHistory(): Promise<{
    mode: "all" | string;
    deletedIds: string[];
    serverTs: number;
}> {
    const res = await fetch("/api/history", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
        // Empty body signals "global delete" mode per the existing API.
        body: JSON.stringify({}),
    });

    if (!res.ok) {
        throw new Error(
            `Failed to delete remote history: ${res.status} ${res.statusText}`
        );
    }

    const data = (await res.json()) as {
        mode: "all" | string;
        deletedIds: string[];
        serverTs: number;
    };

    return data;
}
