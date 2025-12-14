// src/app/api/history/store.ts
//
// Supabase-backed history store for ALL history API routes.
// Replaces the old in-memory Map (which breaks on serverless/Vercel).
//
// Table: public.imotara_history
// Columns:
//  - id (text, PK)
//  - created_at_ms (bigint)
//  - updated_at_ms (bigint)
//  - deleted (boolean)
//  - record (jsonb)

import type { EmotionRecord } from "@/types/history";
import { supabaseServer } from "@/lib/supabaseServer";

const TABLE = "imotara_history";

type DbRow = {
    id: string;
    created_at_ms: number;
    updated_at_ms: number;
    deleted: boolean;
    record: any;
};

function toRow(rec: EmotionRecord): DbRow {
    const createdAt = Number.isFinite(rec.createdAt) ? (rec.createdAt as number) : 0;
    const updatedAt = Number.isFinite(rec.updatedAt) ? (rec.updatedAt as number) : createdAt;
    const deleted = rec.deleted === true;

    return {
        id: rec.id,
        created_at_ms: createdAt,
        updated_at_ms: updatedAt,
        deleted,
        record: rec,
    };
}

function fromRow(row: DbRow): EmotionRecord | null {
    if (!row || typeof row.id !== "string") return null;
    const rec = row.record as EmotionRecord | undefined;
    if (!rec || typeof rec !== "object") return null;

    return {
        ...rec,
        id: row.id,
        createdAt: Number.isFinite(rec.createdAt) ? (rec.createdAt as number) : row.created_at_ms ?? 0,
        updatedAt: Number.isFinite(rec.updatedAt)
            ? (rec.updatedAt as number)
            : row.updated_at_ms ?? row.created_at_ms ?? 0,
        deleted: rec.deleted === true || row.deleted === true,
    };
}

/** Return all records, sorted by createdAt ascending. */
export async function getAllRecords(): Promise<EmotionRecord[]> {
    const { data, error } = await supabaseServer
        .from(TABLE)
        .select("id, created_at_ms, updated_at_ms, deleted, record")
        .order("created_at_ms", { ascending: true });

    if (error) {
        // eslint-disable-next-line no-console
        console.error("getAllRecords supabase error:", error);
        return [];
    }

    return (data as DbRow[]).map(fromRow).filter(Boolean) as EmotionRecord[];
}

/** Upsert a batch of records into the store. */
export async function upsertRecords(records: EmotionRecord[]): Promise<void> {
    const cleaned = (records ?? []).filter(
        (r) => r && typeof r.id === "string" && r.id.trim().length > 0
    );

    if (cleaned.length === 0) return;

    // Prefer newest version per id based on updatedAt (fallback createdAt)
    const bestById = new Map<string, EmotionRecord>();
    for (const rec of cleaned) {
        const existing = bestById.get(rec.id);
        const existingTime =
            (existing?.updatedAt ?? existing?.createdAt ?? Number.NEGATIVE_INFINITY) as number;
        const incomingTime =
            (rec.updatedAt ?? rec.createdAt ?? Number.NEGATIVE_INFINITY) as number;

        if (!existing || incomingTime >= existingTime) {
            bestById.set(rec.id, rec);
        }
    }

    const rows = Array.from(bestById.values()).map(toRow);

    const { error } = await supabaseServer.from(TABLE).upsert(rows, { onConflict: "id" });

    if (error) {
        // eslint-disable-next-line no-console
        console.error("upsertRecords supabase error:", error);
    }
}

/** Get all records updated strictly AFTER the given timestamp. */
export async function getRecordsSince(since: number): Promise<EmotionRecord[]> {
    const cutoff = Number.isFinite(since) ? since : 0;

    const { data, error } = await supabaseServer
        .from(TABLE)
        .select("id, created_at_ms, updated_at_ms, deleted, record")
        .gt("updated_at_ms", cutoff)
        .order("updated_at_ms", { ascending: true });

    if (error) {
        // eslint-disable-next-line no-console
        console.error("getRecordsSince supabase error:", error);
        return [];
    }

    return (data as DbRow[]).map(fromRow).filter(Boolean) as EmotionRecord[];
}

/** (Dev only) Clear everything in the store. */
export async function clearAllRecords(): Promise<void> {
    const { error } = await supabaseServer.from(TABLE).delete().neq("id", "");

    if (error) {
        // eslint-disable-next-line no-console
        console.error("clearAllRecords supabase error:", error);
    }
}
