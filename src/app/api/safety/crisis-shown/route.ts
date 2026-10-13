// src/app/api/safety/crisis-shown/route.ts
//
// Records WHAT THE PERSON ACTUALLY SAW when a crisis card was displayed.
//
// WHY THIS EXISTS SEPARATELY FROM logCrisisEvent():
// detection happens on the server, but the card's LANGUAGE is resolved on the
// client (chat/page.tsx `bannerLang`), deliberately ignoring the stored
// preference — that was the a6f167f fix, because "auto" collapsed to English.
// The server therefore cannot know what was rendered. Only the client can say
// "I displayed a tier-2 card in Bengali with these two helplines", and that
// sentence is the entire defensive value of this log.
//
// ⛔ Still no message text. Ever. This records OUR conduct, not their words.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { CRISIS_BANNER_BY_LANG } from "@/lib/safety/crisisCopy";

export async function POST(req: NextRequest) {
    let body: {
        anonId?: unknown;
        cardLang?: unknown;
        tier?: unknown;
        resourcesCountry?: unknown;
        resourceIds?: unknown;
        platform?: unknown;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }

    // Only accept a language we actually publish a card in. A junk value would
    // make the record claim we showed copy that does not exist.
    const rawLang = typeof body.cardLang === "string" ? body.cardLang.trim().toLowerCase() : "";
    const cardLang = rawLang in CRISIS_BANNER_BY_LANG ? rawLang : null;

    const tier = body.tier === 1 || body.tier === 2 ? body.tier : null;

    const anonId =
        typeof body.anonId === "string" && body.anonId.trim().length >= 8
            ? body.anonId.trim().slice(0, 128)
            : null;

    const resourcesCountry =
        typeof body.resourcesCountry === "string" && /^[A-Za-z]{2}$/.test(body.resourcesCountry.trim())
            ? body.resourcesCountry.trim().toUpperCase()
            : null;

    const resourceIds = Array.isArray(body.resourceIds)
        ? body.resourceIds
              .filter((x): x is string => typeof x === "string")
              .map((x) => x.trim().slice(0, 64))
              .filter(Boolean)
              .slice(0, 12)
        : null;

    const platform = body.platform === "mobile" ? "mobile" : "web";

    let userId: string | null = null;
    try {
        const userClient = await supabaseUserServer();
        const { data } = await userClient.auth.getUser();
        userId = data?.user?.id ?? null;
    } catch {
        userId = null;
    }

    if (!userId && !anonId) {
        return NextResponse.json({ error: "no subject" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Attach to the episode logged by chat-reply within the last hour, so the
    // detection and the display stay one row rather than two half-stories.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const lookup = admin
        .from("crisis_events")
        .select("id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);

    const { data: episode } = userId
        ? await lookup.eq("user_id", userId).maybeSingle()
        : await lookup.eq("anon_id", anonId!).maybeSingle();

    const evidence = {
        card_shown: true,
        card_lang: cardLang,
        tier,
        resources_country: resourcesCountry,
        resource_ids: resourceIds,
    };

    try {
        if (episode?.id) {
            await admin.from("crisis_events").update(evidence).eq("id", episode.id);
        } else {
            // The card can render without chat-reply having logged first (for
            // example a client-side detector firing on a message the server
            // scored differently). A card shown with no record would be the
            // worst outcome, so write a standalone row rather than drop it.
            await admin.from("crisis_events").insert({
                user_id: userId,
                anon_id: anonId,
                platform,
                preferred_lang: null,
                ...evidence,
            });
        }
    } catch (err) {
        // Never surface a logging failure to a person who is in crisis.
        console.error("[safety/crisis-shown] write failed:", err);
        return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
}
