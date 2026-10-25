import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Owner, 26 Oct 2026: soften "fawn response" to plain words. Measured on a
 * preview first: "fawn" fell from 5/6 live replies to 0/6, warmth equal or better.
 *
 * The same measurement caught a FALSE myth leaking: the framework's example
 * "Draupadi … was silent when she needed to roar" appeared near-verbatim in
 * 3/6 live replies — she in fact challenged the court. Removed; stories come
 * only from the checked collection (storiesMustBeReal.test.ts).
 */
const ROUTE = fs.readFileSync(path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");
const lines = ROUTE.split("\n").filter((l) => !/^\s*\/\//.test(l));

describe("replies use plain words for people-pleasing", () => {
    it("the prompt says 'fawn' only in the line that forbids it", () => {
        const hits = lines.filter((l) => /fawn/i.test(l));
        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatch(/never say 'fawn', 'fawning' or 'fawn response'/);
    });

    it("the framework is named in plain words", () => {
        expect(ROUTE).toMatch(/"S3\. PEOPLE-PLEASING \/ KEEPING THE PEACE/);
    });
});

describe("⛔ the false Draupadi example is gone", () => {
    it("no prompt line claims Draupadi stayed silent in the court", () => {
        expect(lines.some((l) => /Draupadi/.test(l) && /silent/i.test(l))).toBe(false);
    });
});
