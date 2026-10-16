// src/lib/account/purgeUserData.ts
//
// The ONE cascade that erases a user. Both callers use it:
//   · DELETE /api/account/delete      — the person asks (App Store 5.1.1(v))
//   · GET  /api/cron/data-retention   — the retention policy requires it
//
// 🔴 WHY THIS IS SHARED AND NOT COPIED. Two hand-kept delete cascades drift,
// and the one that drifts is the one nobody is looking at. The failure mode is
// silent and it is the worst kind here: a table added to the user-facing delete
// but not to the retention job would leave that data behind forever on exactly
// the accounts the privacy policy promises were erased. This file is the single
// place a new user-data table must be registered.
//
// ⚠️ ADDING A TABLE THAT HOLDS USER DATA? Add it to TABLES below and both paths
// inherit it. `src/__tests__/purgeCoversEveryUserTable.test.ts` exists to make
// forgetting noisy rather than silent.
//
// ⛔ auth.admin.deleteUser() MUST BE LAST. It is the only irreversible step that
// also removes the key every other row is matched on; running it first would
// orphan every table above rather than clear them.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

/**
 * Tables keyed by a plain `user_id` column.
 * ⚠️ `imotara_history` is deliberately NOT here — its primary key is a
 * composite `"<userId>:<rowId>"` string, so it needs a LIKE and is handled
 * separately below. That asymmetry is the exact kind of detail a second,
 * copy-pasted cascade gets wrong.
 */
export const USER_ID_TABLES = [
    "user_memory",
    "licenses",
    "payment_licenses",
    "usage_events",
] as const;

export interface PurgeResult {
    /** Non-fatal problems. The purge continues past each one on purpose. */
    errors: string[];
    /** True only when the auth user itself is gone. */
    authDeleted: boolean;
}

/**
 * Erase every trace of one user.
 *
 * ⚠️ Non-fatal errors are collected, not thrown. A single failing table must not
 * strand the rest half-deleted — that leaves a user in a worse state than
 * either outcome. The caller decides what to do with `errors`.
 */
export async function purgeUserData(userId: string): Promise<PurgeResult> {
    const admin = getSupabaseAdmin();
    const errors: string[] = [];

    // History first: composite key, so a LIKE on the id prefix.
    try {
        const { error } = await admin
            .from("imotara_history")
            .delete()
            .like("id", `${userId}:%`);
        if (error) errors.push(`history: ${error.message}`);
    } catch (e) {
        errors.push(`history: ${String(e)}`);
    }

    for (const table of USER_ID_TABLES) {
        try {
            const { error } = await admin.from(table).delete().eq("user_id", userId);
            if (error) errors.push(`${table}: ${error.message}`);
        } catch (e) {
            errors.push(`${table}: ${String(e)}`);
        }
    }

    // ⛔ LAST, always. See the header.
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
        errors.push(`auth: ${authError.message}`);
        return { errors, authDeleted: false };
    }

    return { errors, authDeleted: true };
}
