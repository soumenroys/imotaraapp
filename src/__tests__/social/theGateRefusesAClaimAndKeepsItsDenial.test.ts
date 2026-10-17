/**
 * ⛔ THE SOCIAL GATE MUST REFUSE A CLINICAL CLAIM AND KEEP A DENIAL OF ONE.
 *
 * 🔴 WHAT THIS PINS, and why both halves are needed.
 *
 * The first half is the obvious one: eight claims this product must never make
 * were found in shipped copy on 17 Oct 2026 — "expert counselors", "Human
 * Consultation", "therapy alternative", and "emotional healing" live on
 * Facebook and Instagram. A generator posting daily will produce the ninth.
 * ⇒ trap_marketing_copy_claims_a_regulated_title
 *
 * 🔑 The second half is the one that actually gets a guard switched off. On the
 * same day, a blunt word match flagged "Peer companions, not clinicians" — the
 * brand's own disclaimer — as a violation of the rule it states. A gate that
 * rejects the two most important sentences this brand says is a gate somebody
 * disables by Friday. ⇒ trap_blunt_fix_trades_one_failure_for_its_opposite
 *
 * ⛔ SO PRECISION IS NOT POLISH HERE. Both directions are the test.
 */

import { describe, it, expect } from "vitest";
import { checkVoice, GATE_VOCABULARY } from "@/lib/social/voiceGate";

const hits = (text: string, lang = "en") =>
    checkVoice(text, lang).findings.filter((f) => f.list === "clinical").map((f) => f.matched);

describe("the gate refuses a claim", () => {
    /** The real strings, verbatim. A paraphrase would pass a test the live copy failed. */
    const REAL_DEFECTS = [
        "Talk to our expert counselors today.",
        "Imotara offers Human Consultation when you need it.",
        "A therapy alternative that fits in your pocket.",
        "Emotional healing, in 22 languages.",
        "Our AI therapist listens whenever you need.",
        "A clinically proven way to feel better.",
        "It can diagnose what you are going through.",
        "Mental health care for everyone.",
    ];

    for (const copy of REAL_DEFECTS) {
        it(`rejects: ${copy}`, () => {
            const result = checkVoice(copy, "en");
            expect(result.ok, `the gate let this through: ${copy}`).toBe(false);
            expect(result.findings.some((f) => f.list === "clinical")).toBe(true);
        });
    }

    it("names what it found and why, so a reviewer can act on it", () => {
        const result = checkVoice("A therapy alternative that fits in your pocket.", "en");
        const finding = result.findings.find((f) => f.list === "clinical");
        expect(finding?.matched).toBe("therapy alternative");
        // ⚠️ Pinned because a finding without a reason gets dismissed as noise.
        expect(finding?.because.length).toBeGreaterThan(20);
    });
});

describe("the gate keeps a denial", () => {
    /**
     * Every one of these is a sentence the product already ships, in code, in
     * the consent gate, or on a banner. ⛔ If the gate rejects these it is
     * rejecting the truth, which is the failure that gets it turned off.
     */
    const SHIPPED_DENIALS = [
        "It is not therapy, it does not diagnose, and it is not a crisis service.",
        "Peer companions, not clinicians.",
        "Not therapy, and we say so.",
        "We are not an alternative to therapy.",
        "This is not medical advice and never will be.",
        "Nobody here is a therapist.",
        "It cannot diagnose anything.",
        "There is no clinical claim being made.",
    ];

    for (const copy of SHIPPED_DENIALS) {
        it(`allows: ${copy}`, () => {
            const result = checkVoice(copy, "en");
            expect(
                result.findings.filter((f) => f.list === "clinical"),
                `the gate flagged the brand's own disclaimer: ${copy}`,
            ).toEqual([]);
        });
    }

    it("a denial in one clause does not excuse a claim in the next", () => {
        // 🔑 The subtle case, and the reason the negation check is scoped to a
        // clause rather than the whole string. A post that opens with the
        // disclaimer and then makes the claim anyway is the most likely real
        // shape of this mistake — and the easiest for a lazy implementation to
        // wave through.
        const sneaky = "It is not therapy. But our expert counselors are here for you.";
        expect(hits(sneaky)).toContain("expert counsel");
    });
});

describe("the gate does not fire on good sentences", () => {
    /**
     * 🔑 Each of these contains a word that a blunter list would have banned,
     * and each is a sentence worth writing. They are the reason "treat",
     * "patient", "mental" and "doctor" are absent from the word list and
     * handled as phrases instead.
     */
    const GOOD = [
        "Be patient with yourself on the days it does not come easily.",
        "Treat yourself as kindly as you would treat somebody else.",
        "Mental health is not a project with a deadline.",
        "Talk to your doctor about anything that worries you.",
        "There is no cure being offered here, and no course to complete.",
    ];

    for (const copy of GOOD) {
        it(`allows: ${copy}`, () => {
            expect(hits(copy), `a good sentence was flagged: ${copy}`).toEqual([]);
        });
    }

    it("still catches the claim those words appear in", () => {
        // ⚠️ The pair that proves the precision is real and not just a hole:
        // the gentle use passes, the claim does not.
        expect(hits("Treat yourself kindly.")).toEqual([]);
        expect(hits("It treats anxiety in six weeks.")).toContain("treats anxiety");
        expect(hits("Be patient with yourself.")).toEqual([]);
        expect(hits("Our patients report feeling better.")).toContain("our patients");
    });
});

describe("the vocabulary itself", () => {
    it("carries no word that appears in the product's own disclaimer", () => {
        /**
         * ⛔ A STRUCTURAL CHECK, not a behavioural one. The cases above pin the
         * sentences that exist today. This pins the shape of the mistake: if
         * somebody adds "companion", "peer", "support" or "listen" to the
         * clinical list — all of which sound plausibly clinical — every post
         * this brand wants to write becomes a violation, and the cases above
         * would not necessarily catch it.
         */
        const WORDS_THE_BRAND_NEEDS = [
            "companion", "companions", "peer", "peers", "support", "listen",
            "listens", "feel", "feelings", "mental", "health", "talk", "patient",
            "treat", "doctor",
        ];
        const banned = GATE_VOCABULARY.CLINICAL_TITLES.map((t) => t.word);
        const collisions = WORDS_THE_BRAND_NEEDS.filter((w) => banned.includes(w));
        expect(
            collisions,
            `these are words the brand must be able to use, and they are on the banned list: ${collisions.join(", ")}`,
        ).toEqual([]);
    });

    it("every banned term carries a reason", () => {
        for (const t of GATE_VOCABULARY.CLINICAL_TITLES) {
            expect(t.because, `${t.word} has no reason attached`).toBeTruthy();
        }
        for (const p of GATE_VOCABULARY.CLINICAL_PHRASES) {
            expect(p.because, `${p.phrase} has no reason attached`).toBeTruthy();
        }
    });
});
