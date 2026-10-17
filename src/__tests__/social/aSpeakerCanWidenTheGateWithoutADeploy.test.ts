/**
 * ⛔ A SPEAKER MUST BE ABLE TO WIDEN THE GATE WITHOUT A RELEASE — AND WIDENING
 * IT MUST NOT BE THE SAME ACT AS UNLOCKING UNATTENDED POSTING.
 *
 * 🔑 THE OWNER'S DECISION, 17 Oct: ship English and let "the speaker can
 * enhance this later". So the extension point is a parameter and a table, not
 * an edit to a constant — the day somebody who speaks Bengali is willing to
 * spend ten minutes on it is not the day to be waiting on a deploy.
 *
 * ⚠️ AND THE PART THAT IS EASY TO GET WRONG. Contributing a word list proves
 * only that abuse can be checked. It does not prove anybody here can read a
 * draft and tell a person's voice from a translation's. Those are two separate
 * facts and both are required, so the tests below pin them separately — if they
 * are ever collapsed, contributing six words would silently switch on
 * unattended posting in a language nobody here can read.
 * ⇒ trap_a_guard_satisfied_by_a_neighbouring_value
 */

import { describe, it, expect } from "vitest";
import { checkVoice, canAutoPublishIn, abuseTermsFor } from "@/lib/social/voiceGate";
import { overlayFromRows } from "@/lib/social/store";

describe("the gate stays a pure function", () => {
    it("checks contributed terms that were not in the code", () => {
        const overlay = { abuse: { bn: ["বাজে", "baje"] } };
        expect(checkVoice("tumi khub baje", "bn", overlay).ok).toBe(false);
        // ⛔ And without the overlay, the same post is not checked — which the
        // result says out loud rather than reporting a pass.
        const bare = checkVoice("tumi khub baje", "bn");
        expect(bare.ok).toBe(true);
        expect(bare.listsUnavailable).toContain("abuse");
    });

    it("reports a contributed list as run, not as unavailable", () => {
        const r = checkVoice("a plain sentence", "ta", { abuse: { ta: ["ஒரு"] } });
        expect(r.listsRun).toContain("abuse");
        expect(r.listsUnavailable).not.toContain("abuse");
    });

    it("does not let one language's contribution check another's post", () => {
        const overlay = { abuse: { bn: ["bajekatha"] } };
        const r = checkVoice("bajekatha", "ta", overlay);
        expect(r.listsUnavailable, "a Bengali list was used to check a Tamil post").toContain("abuse");
        expect(r.ok).toBe(true);
    });

    it("tidies what a person typed", () => {
        // A contributed list is typed by hand: stray case, spaces, duplicates.
        expect(abuseTermsFor("bn", { abuse: { bn: ["  Baje  ", "baje", "", "BAJE"] } })).toEqual(["baje"]);
    });

    it("adds to the authored English list rather than replacing it", () => {
        const terms = abuseTermsFor("en", { abuse: { en: ["codswallop"] } });
        expect(terms).toContain("codswallop");
        expect(terms, "a contribution wiped out the shipped list").toContain("fuck");
    });
});

describe("the two conditions on unattended posting stay separate", () => {
    it("a word list alone does not unlock a language nobody here reads", () => {
        // 🔴 THE CASE THAT MATTERS MOST IN THIS FILE. Tamil is not reviewed.
        // Contributing abuse terms must not change that.
        const verdict = canAutoPublishIn("ta", { abuse: { ta: ["ஒரு", "oru"] } });
        expect(verdict.ok, "contributing six words unlocked a language nobody here reads").toBe(false);
        expect(verdict.reason).toMatch(/reads/i);
    });

    it("being readable alone does not unlock a language with no word list", () => {
        const verdict = canAutoPublishIn("bn");
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toMatch(/abuse|profanity/i);
    });

    it("both together do unlock it", () => {
        const verdict = canAutoPublishIn("bn", { abuse: { bn: ["বাজে", "baje"] } });
        expect(verdict.ok, "a reviewed language with a contributed list is still refused").toBe(true);
    });

    it("a language can be marked read without touching the code either", () => {
        const verdict = canAutoPublishIn("ta", { abuse: { ta: ["oru"] }, reviewed: ["ta"] });
        expect(verdict.ok).toBe(true);
    });

    it("neither condition applies to a language this product does not speak", () => {
        expect(canAutoPublishIn("ko", { abuse: { ko: ["x"] }, reviewed: ["ko"] }).ok).toBe(false);
    });
});

describe("the overlay built from the database", () => {
    /**
     * 🔴 THIS BLOCK EXISTS BECAUSE A MUTATION RUN FOUND THE DECISION UNTESTED.
     * `reviewed && abuse_list_ready` could be turned into `||` and the whole
     * suite stayed green — one character between "a language nobody here reads
     * may not post unattended" and "six contributed words unlock it".
     */
    it("⛔ requires BOTH facts, never either", () => {
        const tiers = [
            { code: "en", reviewed: true, abuse_list_ready: true },
            { code: "bn", reviewed: true, abuse_list_ready: false },   // read, no list
            { code: "ta", reviewed: false, abuse_list_ready: true },   // list, nobody reads it
            { code: "or", reviewed: false, abuse_list_ready: false },
        ];
        expect(overlayFromRows([], tiers).reviewed).toEqual(["en"]);
    });

    it("groups contributed terms by their own language", () => {
        const overlay = overlayFromRows(
            [
                { language: "bn", term: "baje" },
                { language: "ta", term: "oru" },
                { language: "bn", term: "বাজে" },
            ],
            [],
        );
        expect(overlay.abuse).toEqual({ bn: ["baje", "বাজে"], ta: ["oru"] });
    });

    it("fails closed on no rows at all", () => {
        // A database that returned nothing must narrow what may be published,
        // never widen it.
        const overlay = overlayFromRows([], []);
        expect(overlay.reviewed).toEqual([]);
        expect(overlay.abuse).toEqual({});
        expect(canAutoPublishIn("en", overlay).ok).toBe(true); // the code list still stands
        expect(canAutoPublishIn("bn", overlay).ok).toBe(false);
    });
});
