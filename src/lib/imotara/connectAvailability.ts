// src/lib/imotara/connectAvailability.ts
//
// #17 (26 Nov 2026): may a reply name Imotara Connect to this person?
//
// Only when it is really on offer:
//   1. the person's own Show Connect switch is on (#108 — off by default, saved on the
//      device, so the client sends it as `connectVisible`), AND
//   2. at least one APPROVED companion exists (the same filter the public listing uses,
//      /api/connect/consultants: status = 'approved').
//
// ⛔ Anything unknown ⇒ false. A missing flag (older app versions), a failed lookup or
// a lookup that has not answered — none of these may put "talk to a real person on
// Imotara Connect" in front of someone who cannot see it.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

/** How long one answer is reused. Companions join or leave over days, not seconds. */
export const COMPANION_CHECK_TTL_MS = 5 * 60 * 1000;

let cached: { at: number; any: boolean } | null = null;

/** True when at least one approved Connect companion exists. Cached; false on any error. */
export async function anyApprovedCompanion(now: number = Date.now()): Promise<boolean> {
    if (cached && now - cached.at < COMPANION_CHECK_TTL_MS) return cached.any;
    try {
        const { count, error } = await getSupabaseAdmin()
            .from("connect_consultants")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved");
        const any = !error && (count ?? 0) > 0;
        cached = { at: now, any };
        return any;
    } catch {
        return false;
    }
}

/** The decision itself, kept pure so it can be tested without a database. */
export function connectIsOffered(connectVisible: unknown, companionExists: boolean): boolean {
    return connectVisible === true && companionExists;
}

/** Test hook: forget the cached answer. */
export function __resetCompanionCheck(): void {
    cached = null;
}
