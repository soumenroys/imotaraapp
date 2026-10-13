// src/app/api/legal/accept/route.ts
//
// Records that someone accepted the Terms and Privacy Policy, and WHICH version.
//
// This is evidence, so it is written server-side with the service role: a client
// that could insert its own acceptance row could also forge one. The client is
// trusted only for the facts it alone knows (the locale it rendered, the device
// id it generated) and even those are stamped against the SERVER clock.
//
// Works for signed-out visitors, because the gate is shown at first use — before
// sign-in. A later sign-in links the anonymous row to the account.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { TERMS_VERSION } from "@/lib/legal/termsVersion";
import { CONSENT_COPY_BY_LANG } from "@/lib/legal/consentCopy";

const SURFACES = new Set(["web", "ios", "android"]);

export async function POST(req: NextRequest) {
    let body: { anonId?: unknown; locale?: unknown; surface?: unknown; acceptedAt?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }

    const anonId =
        typeof body.anonId === "string" && body.anonId.trim().length >= 8
            ? body.anonId.trim().slice(0, 128)
            : null;

    // Only ever store a locale we actually publish copy for. A junk value here
    // would make the record say the person read something that does not exist.
    const rawLocale = typeof body.locale === "string" ? body.locale.trim().toLowerCase() : "en";
    const locale = rawLocale in CONSENT_COPY_BY_LANG ? rawLocale : "en";

    const surface = typeof body.surface === "string" && SURFACES.has(body.surface)
        ? body.surface
        : "web";

    // The client's own timestamp is kept for the record, but a client clock can
    // be wrong or set deliberately, so anything implausible falls back to now.
    const clientTs = typeof body.acceptedAt === "string" ? Date.parse(body.acceptedAt) : NaN;
    const now = Date.now();
    const acceptedAt = Number.isFinite(clientTs) && Math.abs(now - clientTs) < 24 * 60 * 60 * 1000
        ? new Date(clientTs).toISOString()
        : new Date(now).toISOString();

    // Signed in? Attach the account. Not being signed in is normal here.
    let userId: string | null = null;
    try {
        const userClient = await supabaseUserServer();
        const { data } = await userClient.auth.getUser();
        userId = data?.user?.id ?? null;
    } catch {
        userId = null;
    }

    if (!userId && !anonId) {
        // Nothing to tie the row to — it would not be evidence of anything.
        return NextResponse.json({ error: "no subject" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("terms_acceptances").insert({
        user_id: userId,
        anon_id: anonId,
        version: TERMS_VERSION,
        accepted_at: acceptedAt,
        locale,
        surface,
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
    });

    if (error) {
        // ⚠️ Never block the person on a logging failure — they accepted, and
        // refusing them entry because our database hiccuped would be worse than
        // a missing row. The local record still stands; surfaced for alerting.
        console.error("[legal/accept] insert failed:", error.message);
        return NextResponse.json({ ok: false, recorded: false }, { status: 200 });
    }

    // Best-effort: fold any earlier guest acceptance into this account.
    if (userId && anonId) {
        const { error: linkErr } = await admin.rpc("link_terms_acceptance", {
            p_anon_id: anonId,
            p_user_id: userId,
        });
        if (linkErr) console.error("[legal/accept] link failed:", linkErr.message);
    }

    return NextResponse.json({ ok: true, recorded: true, version: TERMS_VERSION });
}
