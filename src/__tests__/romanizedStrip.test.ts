/**
 * Stripping a non-ASCII character must not glue the words around it.
 *
 * The romanized path removes every non-ASCII character, because a romanized
 * Indic reply should be pure ASCII and the model sometimes leaks native
 * script. It replaced them with NOTHING, so any mark written without
 * surrounding spaces merged its neighbours:
 *
 *   "ami tomar shathe achi।tomar oi kotha"  ->  "achitomar"
 *
 * which is the shape of the artefact seen in a real reply on a device
 * 2026-09-12. A danda, an em-dash, an ellipsis and a curly quote all do it.
 *
 * The regex under test is the one in chat-reply's isRomanInput branch; it is
 * duplicated here because the route is a Next handler that cannot be imported
 * in isolation. romanizedStripMatchesRoute() below pins them together.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/** Mirror of the route's strip. */
function strip(candidate: string): string {
    return candidate
        .replace(/[^\x00-\x7F]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\s+([.,!?;:])/g, "$1")
        .trim();
}

describe("word boundaries survive the strip", () => {
    it("a danda between two words does not glue them", () => {
        expect(strip("ami tomar shathe achi।tomar oi kotha")).toBe("ami tomar shathe achi tomar oi kotha");
    });
    it("an em-dash does not glue", () => {
        expect(strip("ami achi—tumi bolo")).toBe("ami achi tumi bolo");
    });
    it("an ellipsis does not glue", () => {
        expect(strip("accha…tumi kemon acho")).toBe("accha tumi kemon acho");
    });
    it("native script between words does not glue", () => {
        expect(strip("ami আছি tomar sathe")).toBe("ami tomar sathe");
    });
});

describe("it does not introduce a gap before punctuation", () => {
    it("a trailing danda leaves no floating stop", () => {
        // Replacing with a space naively would give "ami achi ." here.
        expect(strip("ami achi।")).toBe("ami achi");
    });
    it("a native char before a comma keeps the comma attached", () => {
        expect(strip("ami achi়, tumi bolo")).toBe("ami achi, tumi bolo");
    });
    it("normal ASCII text is untouched", () => {
        expect(strip("ami tomar shathe achi. tumi kemon acho?")).toBe("ami tomar shathe achi. tumi kemon acho?");
    });
});

describe("the route still uses this exact strip", () => {
    it("replaces with a space, never with an empty string", () => {
        const src = fs.readFileSync(
            path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");
        // The bug was the empty replacement. Pin that it is a space.
        expect(src).toMatch(/replace\(\/\[\^\\x00-\\x7F\]\/g, " "\)/);
        expect(src).not.toMatch(/replace\(\/\[\^\\x00-\\x7F\]\/g, ""\)/);
        // and that the punctuation re-attach pass is still there
        expect(src).toMatch(/replace\(\/\\s\+\(\[\.,!\?;:\]\)\/g, "\$1"\)/);
    });
});

describe("the romanized prompt tells the model about punctuation too", () => {
    // The strip is a net, not a cure. The script rules in that prompt said
    // nothing about punctuation or spacing, which is how a danda got emitted
    // in the first place and how words ended up run together.
    const src = fs.readFileSync(
        path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");
    it("asks for ASCII punctuation", () => {
        expect(src).toMatch(/PUNCTUATION: use plain ASCII only/);
    });
    it("names the danda specifically, since that is the one that leaked", () => {
        expect(src).toMatch(/Never a danda/);
    });
    it("asks for spaces between words", () => {
        expect(src).toMatch(/never run two words together/);
    });
    it("sits inside the romanized prompt, not the main one", () => {
        const romanized = src.indexOf("const romanizedPrompt");
        const rule = src.indexOf("PUNCTUATION: use plain ASCII only");
        const nextConst = src.indexOf("\n    const ", romanized + 10);
        expect(rule).toBeGreaterThan(romanized);
        expect(rule).toBeLessThan(nextConst);
    });
});
