/**
 * ⛔ "ALWAYS UNIQUE" MUST MEAN A DIFFERENT POST, NOT A DIFFERENT SENTENCE.
 *
 * 🔑 WHY A UNIQUE INDEX IS NOT ENOUGH. "Odia, and the people who think in it"
 * and "The people who think in Odia" are different strings, hash differently,
 * and are the same post. A database constraint cannot see that; it would let a
 * generator circle the same half-dozen ideas indefinitely while every row was
 * technically distinct.
 *
 * ⛔ AND WHY THE PROMPT IS NOT ENOUGH EITHER. A model asked to "write something
 * new" repeats itself inside a fortnight. The exclusion list makes it less
 * likely to try; the checks below are what make it impossible.
 */

import { describe, it, expect } from "vitest";
import {
    subjectHash,
    normaliseSubject,
    subjectOverlap,
    judgeSubject,
    exclusionList,
    OVERLAP_LIMIT,
    TOPIC_POOLS,
} from "@/lib/social/subjects";

describe("normalisation makes the register mean what it looks like", () => {
    it("collides on differences that are not differences", () => {
        const forms = [
            "The 22 languages",
            "the 22 languages",
            "The 22 languages.",
            "  The   22   languages  ",
            "The 22 languages!",
            "The “22” languages",
        ];
        const hashes = new Set(forms.map(subjectHash));
        // ⚠️ Without normalisation these are six rows and the unique index is
        // decorative.
        expect(hashes.size).toBe(1);
    });

    it("does not collide on an actual difference", () => {
        expect(subjectHash("The 22 languages")).not.toBe(subjectHash("The 11 Indian languages"));
    });

    it("keeps letters in every script it may be handed", () => {
        // 🔑 A normaliser that stripped non-ASCII would hash every Bengali
        // subject to the empty string, and the register would reject the
        // second Bengali post ever written as a duplicate of the first.
        for (const s of ["ইমোতারা এবং ভাষা", "اموتارا اور زبان", "ಇಮೋತಾರಾ ಮತ್ತು ಭಾಷೆ"]) {
            expect(normaliseSubject(s).length, `${s} normalised to nothing`).toBeGreaterThan(3);
        }
        expect(subjectHash("ইমোতারা এবং ভাষা")).not.toBe(subjectHash("اموتارا اور زبان"));
    });
});

describe("overlap catches the same post in different words", () => {
    it("sees the rearranged subject", () => {
        const a = "Odia, and the people who think in it";
        const b = "The people who think in Odia";
        expect(subjectOverlap(a, b)).toBeGreaterThanOrEqual(OVERLAP_LIMIT);
        expect(judgeSubject(a, [b]).ok).toBe(false);
    });

    it("leaves a genuinely different post alone", () => {
        const verdict = judgeSubject("Eleven of the 22 languages are Indian", [
            "The 22 languages this product speaks",
            "What happens to what you type",
            "It works with no signal at all",
        ]);
        expect(verdict.ok, "a different post was rejected as a repeat").toBe(true);
    });

    it("ignores the words every subject shares", () => {
        // Two subjects about nothing alike, joined only by filler.
        const a = "What happens to the words you type";
        const b = "What happens at two in the morning";
        expect(subjectOverlap(a, b)).toBeLessThan(OVERLAP_LIMIT);
    });

    it("names what a rejected subject clashed with", () => {
        const earlier = "The people who think in Odia";
        const verdict = judgeSubject("Odia, and the people who think in it", [earlier]);
        expect(verdict.ok).toBe(false);
        if (verdict.ok) return;
        // ⚠️ A rejection without the clashing subject is unactionable: the
        // reviewer cannot tell whether the register is right.
        expect(verdict.clashesWith).toBe(earlier);
        expect(verdict.reason).toBeTruthy();
    });

    it("rejects an exact repeat however far back it is", () => {
        const history = Array.from({ length: 400 }, (_, i) => `A subject about topic number ${i}`);
        expect(judgeSubject("A subject about topic number 7", history).ok).toBe(false);
    });

    it("rejects something too short to be a subject", () => {
        expect(judgeSubject("hi", []).ok).toBe(false);
    });
});

describe("the exclusion list is help, never the guarantee", () => {
    it("is capped, because its job is to stop a model circling", () => {
        const history = Array.from({ length: 500 }, (_, i) => `Subject ${i}`);
        expect(exclusionList(history).length).toBe(200);
        expect(exclusionList(history, 10).length).toBe(10);
    });

    it("the guarantee still holds outside the window", () => {
        // 🔑 THE POINT. A subject older than the exclusion list is not offered
        // to the model as a thing to avoid — and is still rejected, because the
        // check does not depend on the model having been told.
        const history = Array.from({ length: 500 }, (_, i) => `Subject about the number ${i}`);
        const old = history[480];
        expect(exclusionList(history, 200)).not.toContain(old);
        expect(judgeSubject(old, history).ok).toBe(false);
    });
});

describe("the topic pools", () => {
    it("every pool names something the product does or refuses to do", () => {
        expect(TOPIC_POOLS.length).toBeGreaterThan(4);
        for (const p of TOPIC_POOLS) {
            expect(p.id).toMatch(/^[a-z-]+$/);
            expect(p.label.length).toBeGreaterThan(3);
            // An angle that is one word is not a direction, it is a label twice.
            expect(p.angle.split(/\s+/).length, `${p.id} has no real angle`).toBeGreaterThan(8);
        }
    });

    it("has no pool that invites copy with nothing behind it", () => {
        // ⛔ "Tips", "inspiration" and "motivation" are where a brand with
        // nothing to say ends up, and also where the claims creep back in.
        const text = TOPIC_POOLS.map((p) => `${p.id} ${p.label} ${p.angle}`).join(" ").toLowerCase();
        for (const forbidden of ["inspiration", "motivational", "life hack", "wellness tips"]) {
            expect(text, `a pool invites "${forbidden}"`).not.toContain(forbidden);
        }
    });
});
