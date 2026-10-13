// src/app/api/reminders/snooze/route.ts
//
// Sets or clears the check-in reminder's suppression state.
//
// OWNER DECISION 2026-10-13, option (a):
//   Free → snooze 3 or 5 days only.
//   Plus → may disable permanently.
//
// ⛔ THE TIER CHECK IS ENFORCED HERE, NOT IN THE UI. A client that could set
// `disabled` for itself would get the paid control for free by editing one
// request. The UI's job is to show the right options; this route's job is to
// refuse the wrong ones.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import {
    SNOOZE_MEMORY_TYPE,
    SNOOZE_MEMORY_KEY,
    DISABLED_MEMORY_KEY,
    controlForTier,
    isValidSnoozeDays,
    snoozeUntil,
} from "@/lib/reminders/snooze";

type Action = "snooze" | "disable" | "resume";

export async function POST(req: NextRequest) {
    let body: { action?: unknown; days?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }

    const action = body.action as Action;
    if (action !== "snooze" && action !== "disable" && action !== "resume") {
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }

    const userClient = await supabaseUserServer();
    const { data: auth } = await userClient.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
        // Reminders are a server push to a known account; there is nothing to
        // suppress for someone who is not signed in.
        return NextResponse.json({ error: "sign in required" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // ⚠️ Tier lives at license.tier, not at the root — trap_tier_lives_at_license_tier.
    const { data: lic } = await admin
        .from("licenses")
        .select("tier")
        .eq("user_id", userId)
        .maybeSingle();
    const control = controlForTier(lic?.tier);

    const write = (key: string, value: string | null) =>
        value === null
            ? admin
                  .from("user_memory")
                  .delete()
                  .eq("user_id", userId)
                  .eq("type", SNOOZE_MEMORY_TYPE)
                  .eq("key", key)
            : admin.from("user_memory").upsert(
                  { user_id: userId, type: SNOOZE_MEMORY_TYPE, key, value },
                  { onConflict: "user_id,type,key" },
              );

    if (action === "disable") {
        if (control !== "can_disable") {
            // Free tier. ⚠️ Deliberately NOT a silent no-op: a control that
            // appears to work and does nothing is worse than one that says no.
            return NextResponse.json(
                { error: "upgrade_required", control },
                { status: 403 },
            );
        }
        const { error } = await write(DISABLED_MEMORY_KEY, "1");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        await write(SNOOZE_MEMORY_KEY, null);
        return NextResponse.json({ ok: true, state: "disabled" });
    }

    if (action === "resume") {
        // Always permitted, for every tier. Turning reminders back ON must
        // never be gated — only turning them off is.
        await write(SNOOZE_MEMORY_KEY, null);
        await write(DISABLED_MEMORY_KEY, null);
        return NextResponse.json({ ok: true, state: "active" });
    }

    // action === "snooze"
    if (!isValidSnoozeDays(body.days)) {
        // ⛔ Only 3 or 5. Without this a client could snooze itself for a year
        // and the paid control would be free.
        return NextResponse.json({ error: "invalid days" }, { status: 400 });
    }
    const until = snoozeUntil(body.days);
    const { error } = await write(SNOOZE_MEMORY_KEY, until);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
        ok: true,
        state: "snoozed",
        // The UI must tell the person when reminders come back. Silent
        // resumption is what produces "this app won't stop notifying me".
        until,
        control,
    });
}
