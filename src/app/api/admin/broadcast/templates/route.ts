// src/app/api/admin/broadcast/templates/route.ts
// GET — how often each of the 50 templates has been used, and how it did.
//
// Owner request, 2026-10-15: a counter so an admin can see which template was
// sent how many times, with details.
//
// ⚠️ THE "EDITED" SPLIT IS THE POINT, not a nicety. A template is a starting
// point the admin then rewrites. A bare count would say "this template was
// sent 12 times" when four of those messages no longer resemble it, and a
// panel that looks authoritative while being wrong is worse than no panel. So
// every row reports `used` and `unedited` separately.
//
// ⛔ Aggregated in JS rather than SQL on purpose. PostgREST has no GROUP BY,
// and the alternative — an RPC — would put the catalogue's shape into the
// database, which is exactly where it must not live: the 50 templates are
// TypeScript, and the id is validated against them on write.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { TEMPLATES, AUDIENCE_LABEL } from "@/lib/broadcast/templates";
import { AUDIENCES, AUDIENCE_LABEL as OUTREACH_AUDIENCE, STEPS, STEP_LABEL } from "@/lib/outreach/sequence";
import { draftKey, readOutreach } from "@/lib/outreach/store";
import { OUTREACH_PREFIX } from "@/lib/outreach/record";

/**
 * 🔑 The automatic outreach emails, beside the hand-picked templates (owner,
 * 24 Oct 2026). Every approved version is a broadcasts row whose subject starts
 * "Outreach · <audience> · <email> —", so all versions are counted, not only
 * the current one.
 */
async function outreachUsage(supabase: ReturnType<typeof getSupabaseAdmin>) {
    const state = await readOutreach(supabase);
    const { data: versions } = await supabase.from("broadcasts").select("id, subject").ilike("subject", `${OUTREACH_PREFIX}%`);
    const ids = (versions ?? []).map((v) => v.id as string);
    const tally = new Map<string, { sent: number; delivered: number; bounced: number; complained: number; last: string | null }>();
    if (ids.length) {
        const { data: sends } = await supabase.from("broadcast_sends").select("broadcast_id, status, sent_at").in("broadcast_id", ids);
        for (const x of sends ?? []) {
            const t = tally.get(x.broadcast_id as string) ?? { sent: 0, delivered: 0, bounced: 0, complained: 0, last: null };
            if (x.status !== "skipped") t.sent++;
            if (x.status === "delivered") t.delivered++;
            if (x.status === "bounced") t.bounced++;
            if (x.status === "complained") t.complained++;
            if (x.sent_at && (!t.last || (x.sent_at as string) > t.last)) t.last = x.sent_at as string;
            tally.set(x.broadcast_id as string, t);
        }
    }
    return AUDIENCES.flatMap((a) => STEPS.map((st) => {
        const d = state.drafts[draftKey(a, st)];
        const prefix = `${OUTREACH_PREFIX}${OUTREACH_AUDIENCE[a]} · ${STEP_LABEL[st]} —`;
        const mine = (versions ?? []).filter((v) => (v.subject as string).startsWith(prefix)).map((v) => tally.get(v.id as string));
        const sum = (k: "sent" | "delivered" | "bounced" | "complained") => mine.reduce((n, t) => n + (t?.[k] ?? 0), 0);
        const sent = sum("sent");
        return {
            key: draftKey(a, st),
            audienceLabel: OUTREACH_AUDIENCE[a],
            step: STEP_LABEL[st],
            subject: d?.subject ?? null,
            status: d ? d.status : "not_written",
            versions: mine.length,
            sent, delivered: sum("delivered"), bounced: sum("bounced"), complained: sum("complained"),
            bounceRate: sent > 0 ? Math.round((sum("bounced") / sent) * 1000) / 10 : null,
            lastSent: mine.map((t) => t?.last ?? "").sort().at(-1) || null,
        };
    }));
}

/** Postgres: column does not exist. Means the migration has not been run yet. */
const UNDEFINED_COLUMN = "42703";

export async function GET(req: NextRequest) {
    const auth = await requireOwner(req);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseAdmin();

    const { data: rows, error } = await supabase
        .from("broadcasts")
        .select("id, template_id, template_edited, status, created_at, started_at")
        .not("template_id", "is", null);

    // ⚠️ Degrades honestly rather than 500-ing. This endpoint ships in the same
    // deploy as docs/sql/broadcast_template_usage.sql, and the SQL is applied
    // by hand afterwards — so there is a real window where the column does not
    // exist. The panel says so instead of showing a blank table that would be
    // read as "no template has ever been used".
    if (error) {
        if (error.code === UNDEFINED_COLUMN) {
            return NextResponse.json({
                migrationNeeded: true,
                hint: "Run docs/sql/broadcast_template_usage.sql, then reload.",
                usage: [],
            });
        }
        console.error("[broadcast/templates] GET:", error.message);
        return NextResponse.json({ error: "Could not read template usage" }, { status: 500 });
    }

    const used = rows ?? [];
    const ids = used.map((r) => r.id as string);

    // Delivery outcomes, per broadcast, for the messages that actually went out.
    const byBroadcast = new Map<string, { delivered: number; bounced: number; total: number }>();
    if (ids.length > 0) {
        const { data: sends } = await supabase
            .from("broadcast_sends")
            .select("broadcast_id, status")
            .in("broadcast_id", ids);
        for (const s of sends ?? []) {
            const k = s.broadcast_id as string;
            const agg = byBroadcast.get(k) ?? { delivered: 0, bounced: 0, total: 0 };
            if (s.status !== "skipped") agg.total++;
            if (s.status === "delivered") agg.delivered++;
            if (s.status === "bounced") agg.bounced++;
            byBroadcast.set(k, agg);
        }
    }

    const usage = TEMPLATES.map((t) => {
        const mine = used.filter((r) => r.template_id === t.id);
        const sent = mine.filter((r) => r.status === "sent" || r.status === "sending");
        let delivered = 0, bounced = 0, recipients = 0;
        for (const b of mine) {
            const a = byBroadcast.get(b.id as string);
            if (!a) continue;
            delivered += a.delivered; bounced += a.bounced; recipients += a.total;
        }
        const last = mine
            .map((r) => (r.started_at as string) ?? (r.created_at as string))
            .sort()
            .at(-1) ?? null;

        return {
            id: t.id,
            audience: t.audience,
            audienceLabel: AUDIENCE_LABEL[t.audience],
            title: t.title,
            subject: t.subject,
            /** Drafts started from this template, whether or not they were sent. */
            used: mine.length,
            /** Of those, how many actually went out. */
            sent: sent.length,
            /** Of those used, how many still matched the template when saved. */
            unedited: mine.filter((r) => r.template_edited === false).length,
            recipients,
            delivered,
            bounced,
            /** ⚠️ null, not 0, when nothing was sent — 0% would imply a measurement. */
            bounceRate: recipients > 0 ? Math.round((bounced / recipients) * 1000) / 10 : null,
            lastUsed: last,
        };
    });

    return NextResponse.json({
        migrationNeeded: false,
        usage,
        outreach: await outreachUsage(supabase).catch((e) => { console.error("[broadcast/templates] outreach:", (e as Error).message); return []; }),
        // ⚠️ Counted separately: broadcasts predating templates, or written from
        // scratch, carry template_id NULL and are not attributable to anything.
        totalTemplated: used.length,
    });
}
