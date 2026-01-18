import type { SupabaseClient } from "@supabase/supabase-js";

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

        return (data ?? []) as UserMemoryRow[];
    } catch (err) {
        console.warn("[imotara] fetchUserMemories exception:", err);
        return [];
    }
}