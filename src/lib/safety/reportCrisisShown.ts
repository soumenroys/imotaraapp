// src/lib/safety/reportCrisisShown.ts
//
// Tells /api/safety/crisis-shown WHAT THE PERSON SAW when the crisis card
// appeared: its language, its tier, the country whose helplines it offered and
// which lines. ⛔ Never message text.
//
// 🔴 8 Nov 2026 (#105): the endpoint existed from the start, the chat-reply
// comment said the card "reports it separately" — and nothing ever called it.
// All crisis_events rows had card_shown = null, so the admin Crisis screen could
// not answer the one question it exists for: "was the right country's helpline
// offered?". This module is that missing call.

import type { CountryCrisisResources } from "./crisisResources";

export type CrisisShownReport = {
    anonId: string | null;
    cardLang: string;
    tier: 1 | 2;
    resourcesCountry: string;
    resourceIds: string[];
    platform: "web" | "mobile";
};

/** Exactly the lines the card offered: the primary list, then emergency if any. */
export function buildCrisisShownReport(args: {
    tier: number;
    cardLang: string;
    resources: CountryCrisisResources;
    anonId: string | null;
    platform?: "web" | "mobile";
}): CrisisShownReport | null {
    if (args.tier !== 1 && args.tier !== 2) return null;
    const ids = args.resources.primary.map((r) => r.id);
    if (args.resources.emergency) ids.push(args.resources.emergency.id);
    return {
        anonId: args.anonId,
        cardLang: args.cardLang,
        tier: args.tier,
        resourcesCountry: args.resources.countryCode,
        resourceIds: ids,
        platform: args.platform ?? "web",
    };
}

/**
 * One report per conversation per tier: the card re-renders on every message,
 * but a rise from tier 1 to tier 2 is a new card and is reported again, and so
 * is a change of country or language (that is what the record must show).
 */
export function crisisShownKey(threadId: string | null, r: CrisisShownReport): string {
    return [threadId ?? "-", r.tier, r.cardLang, r.resourcesCountry].join("|");
}

/**
 * Fire-and-forget. A logging failure must never touch the person's screen.
 * 🔑 A signed-out visitor's chat is logged under their guest identity, so the
 * report carries the same guest token (own header, never Authorization) — or the
 * server cannot find that episode and writes a second, unlinked row.
 */
export function sendCrisisShownReport(
    r: CrisisShownReport,
    getGuestToken: () => Promise<string | null> = async () => null,
): void {
    void (async () => {
        let guestToken: string | null = null;
        try { guestToken = await getGuestToken(); } catch { guestToken = null; }
        await fetch("/api/safety/crisis-shown", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(guestToken ? { "x-imotara-guest-token": guestToken } : {}),
            },
            body: JSON.stringify(r),
            keepalive: true,
        });
    })().catch(() => { /* never surface */ });
}
