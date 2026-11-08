// src/__tests__/connectSaysWhenNobodyIsListed.test.ts
// #108 (owner, 8 Nov 2026): Connect had 0 companions, and the empty list said
// "No companions found. Try adjusting your filters." — untrue with no filters
// set. The page now says plainly that nobody is available, points to the chat,
// and invites new companions. The filter message stays for a filtered list.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/connect/page.tsx"), "utf8");

describe("Connect with nobody listed", () => {
    it("says so honestly, offers the chat and the companion sign-up", () => {
        const i = SRC.indexOf("noFiltersActive(filter) ?");
        expect(i).toBeGreaterThan(-1);
        const block = SRC.slice(i, i + 1600);
        expect(block).toMatch(/No companions are available right now\./);
        expect(block).toMatch(/href="\/chat"/);
        expect(block).toMatch(/href="\/connect\/register"/);
        // ⛔ public pages are worldwide and never say "AI"
        expect(block).not.toMatch(/\bAI\b/);
    });

    it("a FILTERED empty list still says to adjust the filters", () => {
        expect(SRC).toMatch(/No companions found\. Try adjusting your filters\./);
    });

    it("'no filters' means every filter is blank or off", () => {
        const fn = SRC.slice(SRC.indexOf("function noFiltersActive("), SRC.indexOf("function noFiltersActive(") + 300);
        for (const k of ["gender", "online", "tag", "category", "lang"]) expect(fn).toContain(`!f.${k}`);
    });
});
