import type { SupabaseClient } from "@supabase/supabase-js";
import { repairLegacyFact } from "@/lib/memory/memoryFacts";

export type MemoryType = "identity" | "emotion" | "cognitive" | "thread";

export type UserMemoryRow = {
    id: string;
    user_id: string;
    type: MemoryType;
    key: string;
    value: string;
    confidence: number;
    last_confirmed_at: string | null;
    created_at: string;
    updated_at: string;
};

export async function fetchUserMemories(
    supabase: SupabaseClient | null | undefined,
    userId: string,
    limit = 20
): Promise<UserMemoryRow[]> {
    // 🛑 Guard: memory disabled or client not initialized
    if (!supabase || !userId) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from("user_memory")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.warn("[imotara] fetchUserMemories error:", error);
            return [];
        }

        // Rows saved before 26 Nov 2026 can hold a feeling saved as a JOB ("User is a/an
        // stressed and overwhelmed"). Every reader (Settings, replies) comes through here, so
        // repair the wording or drop the row here — never hand it to a reply as a fact.
        const out: UserMemoryRow[] = [];
        for (const row of (data ?? []) as UserMemoryRow[]) {
            const value = typeof row.value === "string" ? repairLegacyFact(row.value) : row.value;
            if (value === null) continue;
            out.push(value === row.value ? row : { ...row, value });
        }
        return out;
    } catch (err) {
        console.warn("[imotara] fetchUserMemories exception:", err);
        return [];
    }
}