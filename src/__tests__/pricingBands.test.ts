/**
 * Donation banding — the charge must never be client-decidable.
 *
 * 🔴 WHY. Until 2026-10-03 the web charged one flat rupee ladder to everyone, so
 * a US donor was offered ₹49 (~$0.55) for what an Indian donor pays ₹49 for.
 * Apple and Play had already been banded across 175 storefronts; the web had not.
 *
 * 🔑 What is worth protecting is not the numbers — those are a business decision
 * and will move — but that the AMOUNT is derived server-side from (band, tier),
 * and the band comes from the edge geo header, not from anything the caller sends.
 */
import { describe, it, expect } from "vitest";
import {
    bandForCountry, tierForPresetId, donationPaise, donationPresetsForBand, DONATION_TIERS,
} from "@/lib/imotara/pricingBands";

describe("🔴 band selection", () => {
    it("India and its peers are Band 3", () => {
        for (const cc of ["IN", "PK", "BD", "LK", "ID", "PH", "VN", "NG", "EG"]) {
            expect(bandForCountry(cc)).toBe(3);
        }
    });

    it("the mid-income list is Band 2", () => {
        for (const cc of ["BR", "MX", "PL", "TR", "ZA", "MY", "TH", "CN"]) {
            expect(bandForCountry(cc)).toBe(2);
        }
    });

    it("everywhere else is Band 1", () => {
        for (const cc of ["US", "GB", "DE", "JP", "AU", "CA", "AE", "SG"]) {
            expect(bandForCountry(cc)).toBe(1);
        }
    });

    it("🔴 an UNKNOWN or missing country is Band 1, never Band 3", () => {
        // ⛔ Defaulting to Band 3 would hand the lowest price to every request
        // without a geo header — including bots and anything behind a proxy.
        for (const cc of [undefined, null, "", "   ", "ZZ", "XX"]) {
            expect(bandForCountry(cc as string | null | undefined)).toBe(1);
        }
    });

    it("is case- and whitespace-insensitive", () => {
        expect(bandForCountry("in")).toBe(3);
        expect(bandForCountry(" Br ")).toBe(2);
    });
});

describe("🔑 legacy preset ids keep working — shipped clients depend on them", () => {
    it("maps the web ids to tier POSITIONS, not amounts", () => {
        expect(tierForPresetId("inr_49")).toBe("t1");
        expect(tierForPresetId("inr_999")).toBe("t5");
    });

    it("maps the MOBILE ids too — the published app still sends d-*", () => {
        expect(tierForPresetId("d-49")).toBe("t1");
        expect(tierForPresetId("d-999")).toBe("t5");
    });

    it("accepts the new tier ids directly", () => {
        for (const t of DONATION_TIERS) expect(tierForPresetId(t)).toBe(t);
    });

    it("rejects anything else", () => {
        for (const bad of ["", "t6", "inr_1", "d-1", "../", undefined, null]) {
            expect(tierForPresetId(bad as string)).toBeNull();
        }
    });

    it("🔴 a legacy id does NOT pin the old amount", () => {
        // "d-49" means "the first preset", not "₹49". In Band 1 it costs more.
        expect(donationPaise(1, tierForPresetId("d-49")!)).toBeGreaterThan(
            donationPaise(3, tierForPresetId("d-49")!),
        );
    });
});

describe("⚠️ the ladders are coherent", () => {
    it("every band has five amounts, strictly ascending", () => {
        for (const band of [1, 2, 3] as const) {
            const p = donationPresetsForBand(band).map((x) => x.paise);
            expect(p).toHaveLength(5);
            for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
        }
    });

    it("🔑 a richer band never pays less, at any tier", () => {
        for (const t of DONATION_TIERS) {
            expect(donationPaise(1, t)).toBeGreaterThan(donationPaise(2, t));
            expect(donationPaise(2, t)).toBeGreaterThan(donationPaise(3, t));
        }
    });

    it("Band 3 is India's existing ladder, unchanged", () => {
        expect(donationPresetsForBand(3).map((p) => p.paise))
            .toEqual([4900, 9900, 19900, 49900, 99900]);
    });

    it("labels are whole rupees — no stray paise reach the UI", () => {
        for (const band of [1, 2, 3] as const) {
            for (const p of donationPresetsForBand(band)) {
                expect(p.paise % 100).toBe(0);
                expect(p.label).toMatch(/^₹[\d,]+$/);
            }
        }
    });
});
