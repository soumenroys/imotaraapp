// src/app/api/history/store.ts
//
// Shared in-memory history store for ALL history API routes.
// Both /api/history and /api/history/sync should use this,
// so web + mobile talk to the same backend state.

import type { EmotionRecord } from "@/types/history";

// Use a global singleton so it survives module reloads in dev.
const globalKey = "__imotaraHistoryStore";

type StoreMap = Map<string, EmotionRecord>;

function getGlobalStore(): StoreMap {
    const g = globalThis as any;

    if (!g[globalKey]) {
        g[globalKey] = new Map<string, EmotionRecord>();
    }

    return g[globalKey] as StoreMap;
}

const store = getGlobalStore();

/** Return all records, sorted by createdAt ascending. */
export function getAllRecords(): EmotionRecord[] {
    return Array.from(store.values()).sort((a, b) => {
        const aTime = a.createdAt ?? 0;
        const bTime = b.createdAt ?? 0;
        return aTime - bTime;
    });
}

/** Upsert a batch of records into the store. */
export function upsertRecords(records: EmotionRecord[]): void {
    for (const rec of records) {
        if (!rec || typeof rec.id !== "string") continue;

        const existing = store.get(rec.id);
        // Prefer the newest version based on updatedAt (fallback: createdAt)
        const existingTime =
            existing?.updatedAt ?? existing?.createdAt ?? Number.NEGATIVE_INFINITY;
        const incomingTime =
            rec.updatedAt ?? rec.createdAt ?? Number.NEGATIVE_INFINITY;

        if (!existing || incomingTime >= existingTime) {
            store.set(rec.id, rec);
        }
    }
}

/** Get all records updated strictly AFTER the given timestamp. */
export function getRecordsSince(since: number): EmotionRecord[] {
    const cutoff = Number.isFinite(since) ? since : 0;

    return getAllRecords().filter((rec) => {
        const t = rec.updatedAt ?? rec.createdAt ?? 0;
        return t > cutoff;
    });
}

/** (Dev only) Clear everything in the store. */
export function clearAllRecords(): void {
    store.clear();
}
