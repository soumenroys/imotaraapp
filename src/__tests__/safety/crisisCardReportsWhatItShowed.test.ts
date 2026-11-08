// src/__tests__/safety/crisisCardReportsWhatItShowed.test.ts
// #105 (8 Nov 2026): /api/safety/crisis-shown existed but NOTHING called it —
// every crisis_events row had card_shown = null. These tests pin (1) the report
// carries what the card showed, (2) the chat page actually sends it, from the
// SAME language value the card renders with.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    buildCrisisShownReport,
    crisisShownKey,
    sendCrisisShownReport,
} from "@/lib/safety/reportCrisisShown";
import { getCrisisResourcesForCountry, INTERNATIONAL_CRISIS_RESOURCES } from "@/lib/safety/crisisResources";

describe("the crisis card reports what it showed", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("carries the card's language, tier, country and exactly its lines", () => {
        const india = getCrisisResourcesForCountry("IN");
        const r = buildCrisisShownReport({ tier: 2, cardLang: "bn", resources: india, anonId: "anon-12345678" })!;
        expect(r.cardLang).toBe("bn");
        expect(r.tier).toBe(2);
        expect(r.resourcesCountry).toBe("IN");
        expect(r.resourceIds.slice(0, india.primary.length)).toEqual(india.primary.map((x) => x.id));
        expect(r.platform).toBe("web");
        // ⛔ never message text
        expect(Object.keys(r).sort()).toEqual(["anonId", "cardLang", "platform", "resourceIds", "resourcesCountry", "tier"]);
    });

    it("an unknown country reports the international lines as ZZ (a 2-letter code the endpoint accepts)", () => {
        const r = buildCrisisShownReport({ tier: 1, cardLang: "en", resources: getCrisisResourcesForCountry("??"), anonId: null })!;
        expect(r.resourcesCountry).toBe(INTERNATIONAL_CRISIS_RESOURCES.countryCode);
        expect(r.resourcesCountry).toMatch(/^[A-Z]{2}$/);
    });

    it("no card (tier 0) ⇒ no report", () => {
        expect(buildCrisisShownReport({ tier: 0, cardLang: "en", resources: INTERNATIONAL_CRISIS_RESOURCES, anonId: null })).toBeNull();
    });

    it("one report per conversation per tier — a rise to tier 2 is reported again", () => {
        const res = getCrisisResourcesForCountry("IN");
        const t1 = buildCrisisShownReport({ tier: 1, cardLang: "en", resources: res, anonId: null })!;
        const t2 = buildCrisisShownReport({ tier: 2, cardLang: "en", resources: res, anonId: null })!;
        expect(crisisShownKey("thread-a", t1)).toBe(crisisShownKey("thread-a", { ...t1 }));
        expect(crisisShownKey("thread-a", t1)).not.toBe(crisisShownKey("thread-a", t2));
        expect(crisisShownKey("thread-a", t1)).not.toBe(crisisShownKey("thread-b", t1));
    });

    it("POSTs to /api/safety/crisis-shown and never throws when the network fails", async () => {
        const fetchMock = vi.fn(async () => { throw new Error("offline"); });
        vi.stubGlobal("fetch", fetchMock);
        const r = buildCrisisShownReport({ tier: 2, cardLang: "hi", resources: getCrisisResourcesForCountry("IN"), anonId: "anon-12345678" })!;
        expect(() => sendCrisisShownReport(r)).not.toThrow();
        await Promise.resolve();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("/api/safety/crisis-shown");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toMatchObject({ cardLang: "hi", tier: 2, resourcesCountry: "IN" });
    });

    it("the chat page sends it, from the same language the card renders", () => {
        const src = readFileSync(join(process.cwd(), "src/app/chat/page.tsx"), "utf8");
        expect(src).toMatch(/sendCrisisShownReport\(report\)/);
        expect(src).toMatch(/cardLang:\s*crisisCard\.lang/);
        expect(src).toMatch(/const bannerLang = crisisCard\.lang;/);
        // the card is gated on the same value
        expect(src).toMatch(/\{crisisCard && \(\(\) => \{/);
    });
});
