/**
 * A goodbye must not be cut off mid-word.
 *
 * 🔴 Seen in production 2026-10-10, the one runtime log in the window:
 *   [imotara][aiClient] reply TRUNCATED at maxTokens
 *   (maxTokens=80, completion_tokens=80, model=gpt-4.1-2025-04-14)
 *
 * 80 is the closure-intent budget — a deliberately short send-off. But closure
 * replies were EXCLUDED from the non-English script scaling that every other
 * reply gets, so a goodbye in Bengali had 80 tokens where a normal Bengali
 * reply had 1.4x its budget. Indic scripts tokenise far more heavily per unit
 * of meaning, which is why that scaling exists at all — and 80 does not cover
 * the "1–2 short sentences" the closure prompt itself asks for.
 *
 * ⚠️ The prompt promises the opposite: "CRITICAL: Always finish your last
 * sentence completely — never end mid-sentence or mid-word."
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { replyTokenBudget } from "../app/api/chat-reply/route";

const SRC = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");

/**
 * ⚠️ THE REAL ARITHMETIC, imported.
 *
 * The first version of this file re-implemented the depth table (200 / 220 /
 * 320) and the 1.4 multiplier locally. That is the mirror trap: a change to
 * any of those numbers in the route would have left this test green, because
 * it was agreeing with its own copy. Only the closure 80 was read from source.
 */
const budget = (depth: string, closure: boolean, lang: string) =>
    replyTokenBudget(closure, depth, lang);

describe("🔴 a non-English send-off gets the same headroom as any other reply", () => {
    it("Bengali closure is scaled, not left at the English budget", () => {
        expect(budget("light", true, "bn")).toBe(112);
        expect(budget("light", true, "bn")).toBeGreaterThan(budget("light", true, "en"));
    });

    it("every Indian language gets it", () => {
        for (const l of ["hi", "bn", "ta", "te", "mr", "gu", "pa", "kn", "ml", "or", "ur"]) {
            expect(budget("light", true, l), l).toBe(112);
        }
    });

    it("the foreign languages too", () => {
        for (const l of ["ar", "he", "ru", "zh", "ja", "es", "fr", "de", "pt", "id"]) {
            expect(budget("light", true, l), l).toBe(112);
        }
    });
});

describe("⚖️ what must NOT have changed", () => {
    it("an English closure reply is still 80 — the cap keeps it short", () => {
        expect(budget("light", true, "en")).toBe(80);
    });

    it("a closure reply is still much shorter than a normal one", () => {
        // Removing the cap would 'fix' truncation by deleting the feature.
        expect(budget("light", true, "bn")).toBeLessThan(budget("light", false, "bn"));
        expect(budget("deep", false, "bn")).toBe(448);
    });

    it("normal replies keep exactly the budgets they had", () => {
        expect(budget("light", false, "en")).toBe(200);
        expect(budget("moderate", false, "en")).toBe(220);
        expect(budget("deep", false, "en")).toBe(320);
        expect(budget("light", false, "bn")).toBe(280);
        expect(budget("moderate", false, "bn")).toBe(308);
    });

    it("the closure prompt still asks for a short, question-free send-off", () => {
        // The budget is only safe because the prompt asks for brevity.
        expect(SRC).toMatch(/Keep it to 1–2 short sentences\./);
        expect(SRC).toMatch(/Do NOT ask ANY question/);
    });

    it("…and still insists on finishing the sentence", () => {
        expect(SRC).toMatch(/Always finish your last sentence completely/);
    });
});

describe("⛔ the exclusion must not come back", () => {
    it("the SCALING step no longer tests isClosureIntent", () => {
        // ⚠️ RE-POINTED after the extraction, not relaxed. The exclusion is
        // the defect, so what matters is that the multiplier is applied
        // without consulting it.
        const i = SRC.indexOf("export function replyTokenBudget(");
        expect(i).toBeGreaterThan(-1);
        const fn = SRC.slice(i, SRC.indexOf("\n}", i));
        const ret = fn.slice(fn.indexOf("return ("));
        expect(ret).toMatch(/resolvedLang && resolvedLang !== "en"/);
        expect(ret).not.toMatch(/isClosureIntent/);
    });

    it("the closure budget itself is still deliberate, not accidental", () => {
        const i = SRC.indexOf("export function replyTokenBudget(");
        const fn = SRC.slice(i, SRC.indexOf("\n}", i));
        expect(fn).toMatch(/isClosureIntent\s*\n?\s*\?\s*80/);
    });

    it("POST uses this function rather than its own copy of the maths", () => {
        expect(SRC).toMatch(
            /const maxTokens = replyTokenBudget\(isClosureIntent, arc\.depth, resolvedLang\);/);
        // ⛔ The inline version must be gone, or the two could drift.
        expect(SRC).not.toMatch(/const baseMaxTokens =/);
    });
});
