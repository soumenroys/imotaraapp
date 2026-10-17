/**
 * ⛔ THE COUNTABLE RULES MUST BE COUNTED — AND MUST STAY ADVICE, NOT A GATE.
 *
 * 🔑 THE DISTINCTION THIS FILE PROTECTS. `checkVoice` returns findings that
 * REJECT a draft: a clinical claim or an abusive word is not a matter of taste
 * and a person may not wave it through. `checkHouseStyle` returns problems that
 * a person may knowingly overrule — a post three characters over LinkedIn's
 * fold is a judgement call, not a violation.
 *
 * ⚠️ Collapsing the two in either direction is a real failure. Make house style
 * blocking and a reviewer fights the tool over a hashtag; fold the gate into
 * advice and a regulated title becomes a suggestion.
 *
 * 🔴 THIS FILE EXISTS BECAUSE A MUTATION RUN FOUND NOTHING TESTING IT. Deleting
 * the emoji check broke no test, so every rule here was decorative.
 */

import { describe, it, expect } from "vitest";
import { checkHouseStyle, checkVoice, PLATFORM_LIMITS } from "@/lib/social/voiceGate";

describe("what it counts", () => {
    it("counts emoji, which the house style forbids in the body", () => {
        const r = checkHouseStyle("Somewhere to say how you actually feel 🙂", "facebook");
        expect(r.emoji).toBe(1);
        expect(r.ok).toBe(false);
        expect(r.problems.join(" ")).toMatch(/emoji/i);
    });

    it("counts a multi-codepoint emoji as one", () => {
        // ⚠️ A family or a flag is several codepoints. Counting characters
        // instead of graphemes would report four emoji and read as a bug.
        const r = checkHouseStyle("Hello 👩‍👩‍👧", "facebook");
        expect(r.emoji).toBeGreaterThan(0);
        expect(r.ok).toBe(false);
    });

    it("allows up to two hashtags and objects to a third", () => {
        expect(checkHouseStyle("A post #one #two", "linkedin").problems.join(" ")).not.toMatch(/hashtag/i);
        expect(checkHouseStyle("A post #one #two #three", "linkedin").problems.join(" ")).toMatch(/hashtag/i);
    });

    it("counts a hashtag in a non-Latin script", () => {
        // A Bengali or Tamil hashtag is still a hashtag. A `[A-Za-z0-9]` class
        // would have counted zero on a post in 19 of the 22 languages.
        const r = checkHouseStyle("কথা #বাংলা #ভাষা #মন", "facebook");
        expect(r.hashtags).toBe(3);
        expect(r.ok).toBe(false);
    });

    it("allows one link and objects to two", () => {
        expect(checkHouseStyle("Read https://www.imotara.com today", "linkedin").links).toBe(1);
        const two = checkHouseStyle("https://www.imotara.com and https://www.imotara.com/help", "linkedin");
        expect(two.links).toBe(2);
        expect(two.problems.join(" ")).toMatch(/link/i);
    });

    it("counts characters by code point, not by UTF-16 unit", () => {
        // ⚠️ `.length` counts UTF-16 units, so text outside the basic plane is
        // over-counted and a post could be reported as over a limit it is
        // nowhere near — on exactly the channels this feature exists to serve.
        // ⛔ Code points are not graphemes either, and no platform counts the
        // same way (X weights its own); these numbers are for the reviewer's
        // judgement, which is why length is advice and not a gate.
        const r = checkHouseStyle("ইমোতারা", "x");
        expect(r.characters).toBeLessThan(10);
        expect(r.ok).toBe(true);

        /**
         * ⚠️ THE ASSERTION ABOVE CANNOT CATCH THE BUG, which a mutation run
         * showed: Bengali lives in the basic plane, so [...text].length and
         * text.length agree and swapping one for the other breaks nothing. The
         * difference only appears OUTSIDE that plane — so the case has to use
         * a surrogate pair to assert anything at all.
         */
        const astral = "\u{1F469}\u{1F3FD}";       // one person, two code points
        expect(astral.length, "the fixture is not a surrogate pair").toBe(4);
        expect(checkHouseStyle(astral, "x").characters).toBe(2);
    });
});

describe("the platform limits", () => {
    it("knows a hard ceiling and a fold point for every platform it may post to", () => {
        for (const platform of ["facebook", "linkedin", "instagram", "x"]) {
            const limit = PLATFORM_LIMITS[platform];
            expect(limit, `no limits for ${platform}`).toBeTruthy();
            expect(limit.soft).toBeLessThanOrEqual(limit.hard);
        }
    });

    it("distinguishes 'the platform will refuse this' from 'the reader sees see-more'", () => {
        const folded = checkHouseStyle("a".repeat(1500), "linkedin");
        expect(folded.problems.join(" ")).toMatch(/see more/i);
        expect(folded.problems.join(" ")).not.toMatch(/will not accept/i);

        const refused = checkHouseStyle("a".repeat(4000), "linkedin");
        expect(refused.problems.join(" ")).toMatch(/will not accept/i);
    });

    it("says nothing about length for an unknown platform rather than guessing", () => {
        // ⛔ A made-up ceiling would either reject a valid post or let an
        // invalid one through, and both are worse than silence.
        const r = checkHouseStyle("a".repeat(5000), "mastodon");
        expect(r.problems.join(" ")).not.toMatch(/characters/i);
    });
});

describe("advice and the gate stay separate", () => {
    it("a post that is only over-long is clean by the gate", () => {
        const long = "A plain sentence about nothing in particular. ".repeat(60);
        expect(checkVoice(long, "en").ok, "the gate rejected a post for being long").toBe(true);
        expect(checkHouseStyle(long, "linkedin").ok).toBe(false);
    });

    it("a post that is tidy but makes a claim is rejected by the gate", () => {
        const copy = "Our therapist is here.";
        expect(checkHouseStyle(copy, "linkedin").ok, "house style objected to a short clean post").toBe(true);
        expect(checkVoice(copy, "en").ok).toBe(false);
    });

    it("house style returns problems, never findings", () => {
        // 🔑 Structural. If these two ever return the same shape, the admin can
        // render a matter of taste with the same weight as a regulated title.
        const style = checkHouseStyle("Hello 🙂", "facebook");
        expect(Array.isArray(style.problems)).toBe(true);
        expect("findings" in style).toBe(false);
        expect("problems" in checkVoice("Hello", "en")).toBe(false);
    });

    it("a clean, plain post passes both", () => {
        const copy =
            "Most of the hard hours are not office hours. Imotara is awake then, in whichever " +
            "of 22 languages you think in. It is not therapy and does not pretend to be.";
        expect(checkVoice(copy, "en").ok).toBe(true);
        expect(checkHouseStyle(copy, "linkedin").ok).toBe(true);
    });
});
