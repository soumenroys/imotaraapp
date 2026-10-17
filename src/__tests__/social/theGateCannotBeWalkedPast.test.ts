/**
 * ⛔ THE GATE MUST NOT BE WALKABLE-PAST BY ACCIDENT.
 *
 * The other gate test asks whether the right sentences are caught. This one
 * assumes the lists are correct and attacks the MATCHING — the part that is
 * quietly wrong in a way no amount of vocabulary fixes.
 *
 * 🔑 EVERY CASE BELOW IS A REAL SHAPE, not a contrived attack. Nobody is trying
 * to defeat this gate. The text it will see comes from a model, from a pasted
 * draft, and from a person typing in a textarea at eleven at night — and all
 * three produce zero-width characters, non-breaking spaces, curly apostrophes,
 * a disclaimer followed by the claim, and words like "psychotherapist" that
 * contain a banned word without matching it.
 *
 * ⚠️ WRITTEN BEFORE THE FIXES. Four of these failed on the first run, which is
 * the only evidence that they are not mirrors of the implementation
 * ⇒ trap_a_mirror_test_cannot_catch_a_refactor.
 */

import { describe, it, expect } from "vitest";
import { checkVoice } from "@/lib/social/voiceGate";

const clinical = (text: string, lang = "en") =>
    checkVoice(text, lang).findings.filter((f) => f.list === "clinical").map((f) => f.matched);

describe("a denial earlier in the text does not cover a claim later", () => {
    it("catches the second occurrence when the first one was denied", () => {
        /**
         * 🔴 THE HOLE THIS FOUND. The matcher looked for the FIRST occurrence
         * of each term and asked whether that one was denied. A post that
         * opened with the disclaimer and then made the claim therefore passed
         * cleanly — and that is the single most likely real shape of this
         * mistake, because every writer here knows to put the disclaimer in.
         */
        const text = "It does not heal anything. Imotara heals you from the inside.";
        expect(clinical(text), "a denial in sentence one covered the claim in sentence two").toContain("heals");
    });

    it("catches a claim repeated after two denials", () => {
        const text =
            "Not a therapist. Never a therapist. Our therapist will see you now.";
        expect(clinical(text)).toContain("therapist");
    });

    it("still allows a word denied every time it appears", () => {
        const text = "It is not therapy. It does not diagnose. Nobody here is a clinician.";
        expect(clinical(text), "a post that denies throughout was flagged").toEqual([]);
    });

    it("a newline ends a clause, so a denial does not reach the next line", () => {
        /**
         * 🔴 FOUND BY A MUTATION RUN, not by reading the code. The normaliser
         * briefly folded all whitespace to spaces — a line that looked
         * harmless, broke no test when deleted, and flattened the newlines that
         * separate clauses. A post laid out as two lines with no full stop
         * between them then read as one clause, the disclaimer reached across
         * the break, and the claim went out.
         *
         * ⚠️ Social posts are written in short lines without terminal
         * punctuation far more often than prose is. This is the normal shape of
         * a caption, not an edge case.
         */
        const text = "Not therapy\nOur therapist is here for you";
        expect(clinical(text), "a denial on line one excused a claim on line two").toContain("therapist");
    });

    it("reports each distinct term once, not once per occurrence", () => {
        // ⚠️ A reviewer reading forty copies of the same finding stops reading.
        const text = "Our therapist is a therapist and our therapist listens.";
        const found = clinical(text).filter((m) => m === "therapist");
        expect(found.length).toBe(1);
    });
});

describe("a banned word hiding inside a longer one", () => {
    it("catches psychotherapist, which contains therapist without matching it", () => {
        // 🔴 FOUND HERE. Word boundaries meant "psychotherapist" sailed past a
        // list containing "therapist", because the letter before it is a
        // letter. The most clinical word available was the one that passed.
        expect(clinical("Speak to our psychotherapist today.")).not.toEqual([]);
    });

    const CLINICAL_RELATIVES = [
        "Our psychotherapy sessions start at ten.",
        "A therapeutic experience, every day.",
        "We are diagnosing the problem for you.",
        "Thousands healed last year.",
        "A trained psychotherapist wrote this.",
        "Curing loneliness, one chat at a time.",
    ];

    for (const copy of CLINICAL_RELATIVES) {
        it(`catches: ${copy}`, () => {
            expect(checkVoice(copy, "en").ok, `let through: ${copy}`).toBe(false);
        });
    }

    it("does not catch an innocent word that merely contains letters", () => {
        // ⛔ The other direction: suffix tolerance must not become substring
        // matching, or "therapist" starts firing on nothing in particular and
        // "healthy" on "heal".
        const INNOCENT = [
            "A healthy amount of sleep helps.",
            "The theatre was full.",
            "Curiosity is welcome here.",
            "It treats you as an adult.",
        ];
        for (const copy of INNOCENT) {
            expect(clinical(copy), `a harmless sentence was flagged: ${copy}`).toEqual([]);
        }
    });
});

describe("characters that arrive with pasted text", () => {
    it("sees through a zero-width character", () => {
        // 🔴 FOUND HERE. Pasting from a design tool, a PDF or a chat window
        // brings zero-width joiners and soft hyphens with it. The word looks
        // identical on screen and matched nothing.
        const zwsp = "thera​pist";
        expect(clinical(`Our ${zwsp} is here.`), "a zero-width space defeated the gate").not.toEqual([]);
    });

    it("sees through a non-breaking space inside a phrase", () => {
        expect(clinical("A therapy alternative in your pocket."), "an nbsp defeated the phrase match")
            .toContain("therapy alternative");
    });

    it("sees through a curly apostrophe", () => {
        expect(clinical("Our patient’s words stay private.")).not.toEqual([]);
    });

    it("sees through a soft hyphen", () => {
        expect(clinical("coun­selling available now")).not.toEqual([]);
    });

    it("is not confused by ordinary accented text around a term", () => {
        expect(checkVoice("Un café, et notre therapist.", "fr").ok).toBe(false);
    });
});

describe("the matcher itself", () => {
    it("treats a term with a regex character as text, not as a pattern", () => {
        // ⛔ Nothing in the lists has one today. This pins the behaviour anyway,
        // because the day somebody adds "c.b.t." the gate would either throw or
        // silently match everything, and both are worse than the word missing.
        expect(() => checkVoice("anything at all", "en")).not.toThrow();
        expect(checkVoice("a.b.c.d.e", "en").ok).toBe(true);
    });

    it("does not take unreasonable time on a long post", () => {
        const long = "A plain sentence about nothing in particular. ".repeat(400);
        const started = Date.now();
        checkVoice(long, "en");
        expect(Date.now() - started, "the gate is too slow to run on every keystroke").toBeLessThan(400);
    });

    it("handles an empty post without throwing", () => {
        expect(checkVoice("", "en").ok).toBe(true);
        expect(checkVoice("   ", "en").ok).toBe(true);
    });
});
