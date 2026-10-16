// GET /api/cron/data-retention
//
// GDPR Art. 5(1)(e) storage limitation. Warns dormant accounts, then erases
// them 30 days later. ⇒ docs/sql/data_retention.sql for the schema and policy.
//
// 🔴 REPORT-ONLY UNTIL `IMOTARA_RETENTION_ENFORCE=true`.
// This is the only job in the system that destroys user data on a timer, with
// nobody watching and no undo. It therefore ships inert: it finds candidates,
// writes down what it WOULD have done, and deletes nothing. The owner reads a
// few weeks of retention_runs rows, satisfies themselves the candidate set is
// what they expect, and only then flips the flag.
// ⛔ Do not default this to enforcing. A bug here is unrecoverable, and the
// data is people's mental-health history.
//
// ⚠️ Vercel Cron calls this as **GET with `Authorization: Bearer $CRON_SECRET`**
// — not POST. Two of this project's seven crons were dead for MONTHS because
// that was got wrong, and nothing surfaced it. Which is why EVERY run writes a
// retention_runs row even when it does nothing: the absence of rows is the
// alarm, and it is the only signal a silent death produces.

export const preferredRegion = ["sin1"];
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { purgeUserData } from "@/lib/account/purgeUserData";
import {
    RETENTION_INACTIVE_MONTHS,
    RETENTION_GRACE_DAYS,
    retentionEnforcing,
} from "@/lib/account/retentionPolicy";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// 🔑 The same constants /privacy writes into its prose, so the promise and the
// timer cannot disagree. ⇒ src/lib/account/retentionPolicy.ts
const INACTIVE_MONTHS = RETENTION_INACTIVE_MONTHS;
const GRACE_DAYS = RETENTION_GRACE_DAYS;

interface Candidate {
    user_id: string;
    email: string | null;
    last_active_at: string;
    warned_at: string | null;
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const enforce = retentionEnforcing();
    const errors: string[] = [];

    const { data, error } = await admin.rpc("retention_candidates", {
        p_months: INACTIVE_MONTHS,
    });

    if (error) {
        // ⚠️ Still write the run row. A failed run that leaves no trace is
        // indistinguishable from a cron that never fired.
        await admin.from("retention_runs").insert({
            enforced: enforce,
            errors: [`candidates: ${error.message}`],
        });
        return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
    }

    const candidates = (data ?? []) as Candidate[];
    const graceCutoff = Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000;

    const toWarn = candidates.filter((c) => c.warned_at === null);
    const toPurge = candidates.filter(
        (c) => c.warned_at !== null && new Date(c.warned_at).getTime() < graceCutoff,
    );

    let warned = 0;
    let purged = 0;

    if (enforce) {
        for (const c of toWarn) {
            // ⚠️ The warning row is written whether or not the email sends.
            // Erasure is gated on having warned; if a send failure stopped the
            // row being written, the account would be re-warned forever and
            // never reach the grace period — dormant data kept indefinitely by
            // a mail outage, which is the opposite of the point.
            const { error: wErr } = await admin
                .from("retention_warnings")
                .insert({ user_id: c.user_id, email: c.email });
            if (wErr) {
                errors.push(`warn ${c.user_id}: ${wErr.message}`);
                continue;
            }
            warned += 1;
        }

        for (const c of toPurge) {
            const result = await purgeUserData(c.user_id);
            if (!result.authDeleted) {
                errors.push(`purge ${c.user_id}: ${result.errors.join("; ")}`);
                continue;
            }
            // ⛔ Mark purged BEFORE counting it. The warning row outlives the
            // user on purpose — it is the evidence that notice was given.
            const { error: pErr } = await admin
                .from("retention_warnings")
                .update({ purged_at: new Date().toISOString() })
                .eq("user_id", c.user_id);
            if (pErr) errors.push(`mark ${c.user_id}: ${pErr.message}`);
            purged += 1;
        }
    }

    const { error: runErr } = await admin.from("retention_runs").insert({
        enforced: enforce,
        candidates: candidates.length,
        warned,
        purged,
        errors,
    });
    if (runErr) console.error("[data-retention] run row failed:", runErr.message);

    return NextResponse.json({
        ok: true,
        enforced: enforce,
        candidates: candidates.length,
        wouldWarn: toWarn.length,
        wouldPurge: toPurge.length,
        warned,
        purged,
        errors: errors.length ? errors : undefined,
    });
}
