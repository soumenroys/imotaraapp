// #143 (owner, 14 Nov 2026): the UK crisis card carries Childline for young
// people, next to Samaritans, Shout and 999 — before any UK school is called.
//
// ⛔ The note claims no opening hours: childline.org.uk's own page states the
// number and the age (under 19) but no hours, and a crisis card must never
// promise an answer it cannot guarantee.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCrisisResourcesForCountry, UK_CRISIS_RESOURCES } from "@/lib/safety/crisisResources";

describe("UK crisis card — Childline (#143)", () => {
    it("lists Childline 0800 1111 for under-19s", () => {
        const childline = UK_CRISIS_RESOURCES.primary.find((r) => r.contact === "0800 1111");
        expect(childline).toBeDefined();
        expect(childline!.label).toMatch(/Childline/);
        expect(childline!.note).toMatch(/under 19/);
    });

    it("keeps Samaritans first and 999 as the emergency line", () => {
        const gb = getCrisisResourcesForCountry("GB");
        expect(gb.primary[0].contact).toBe("116 123");
        expect(gb.emergency?.contact).toBe("999");
        expect(gb.primary.map((r) => r.contact)).toContain("0800 1111");
    });

    it("claims no opening hours it cannot source", () => {
        const childline = UK_CRISIS_RESOURCES.primary.find((r) => r.contact === "0800 1111")!;
        expect(childline.note ?? "").not.toMatch(/24\/7|24 hours|any time|midnight/i);
    });

    it("the Connect emergency modal shows it for GB too", () => {
        const src = readFileSync(join(process.cwd(), "src/components/connect/EmergencyModal.tsx"), "utf8");
        expect(src).toMatch(/GB: \[[\s\S]*?"0800 1111"[\s\S]*?\]/);
    });
});
