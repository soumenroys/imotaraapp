/**
 * #17 (26 Nov 2026): a reply may name Imotara Connect only when the person's own Show
 * Connect switch is on AND an approved companion exists. Anything unknown ⇒ not offered.
 */
import { describe, it, expect } from "vitest";
import { connectIsOffered, COMPANION_CHECK_TTL_MS } from "@/lib/imotara/connectAvailability";
import fs from "fs";
import path from "path";

describe("connectIsOffered", () => {
    it("needs BOTH the switch and a companion", () => {
        expect(connectIsOffered(true, true)).toBe(true);
        expect(connectIsOffered(true, false)).toBe(false);
        expect(connectIsOffered(false, true)).toBe(false);
    });

    it("⛔ only a literal true counts — missing, strings and numbers do not", () => {
        for (const v of [undefined, null, "true", 1, "1", {}]) expect(connectIsOffered(v, true)).toBe(false);
    });
});

describe("the companion lookup", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/imotara/connectAvailability.ts"), "utf8");

    it("uses the public listing's filter (approved companions)", () => {
        expect(src).toContain('.from("connect_consultants")');
        expect(src).toContain('.eq("status", "approved")');
    });

    it("fails closed and is cached", () => {
        expect(src).toMatch(/catch \{\s*return false;\s*\}/);
        expect(COMPANION_CHECK_TTL_MS).toBe(5 * 60 * 1000);
    });
});
