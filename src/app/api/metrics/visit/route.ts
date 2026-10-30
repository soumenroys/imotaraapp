// POST /api/metrics/visit — anonymous visit tallies. ⇒ lib/analytics/visitTally.ts
//
// ⛔ Reads nothing about the sender but the platform (web/ios/android), and
// stores nothing but a daily count per kind and bucket. No auth on purpose:
// guests are exactly who this exists to count, and an account would make the
// tally personal.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { resolvePlatform } from "@/lib/imotara/clientPlatform";
import { parseTallyEvents } from "@/lib/analytics/visitTally";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    let body: unknown = null;
    try {
        body = await req.json();
    } catch {
        // sendBeacon may arrive as text/plain — try that before giving up.
        try { body = JSON.parse(await req.text()); } catch { body = null; }
    }
    const events = parseTallyEvents(body);
    if (events.length === 0) return new NextResponse(null, { status: 204 });

    const platform = resolvePlatform(req);
    try {
        const db = getSupabaseAdmin();
        await Promise.all(events.map((e) =>
            db.rpc("imotara_record_visit_tally", {
                p_platform: platform,
                p_kind: e.kind,
                p_bucket: e.bucket,
                p_delta: e.delta,
            })
        ));
    } catch {
        // ⛔ Silent: a lost tally is not worth an error page, a retry storm, or a log line per visit.
    }
    return new NextResponse(null, { status: 204 });
}
