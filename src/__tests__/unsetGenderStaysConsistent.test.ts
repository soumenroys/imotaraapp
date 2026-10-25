import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Measured 26 Oct 2026: with no gender set, an Arabic reply switched from the
// masculine to the feminine halfway through. The prompt had no line at all for
// the unset case.
const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");

describe("when the user's gender is not given", () => {
    const block = SRC.slice(SRC.indexOf("USER GENDER: not given."), SRC.indexOf("USER GENDER: not given.") + 900);

    it("the prompt has a line for it", () => {
        expect(block.length).toBeGreaterThan(100);
    });

    it("follows the gender the user's own words show, else avoids gendered forms", () => {
        expect(block).toMatch(/if the user's own words show their gender/);
        expect(block).toMatch(/أنا متعبة/);
        expect(block).toMatch(/я устала/);
        expect(block).toMatch(/prefer phrasing that avoids gendered forms/);
    });

    it("⛔ never switches mid-reply", () => {
        expect(block).toMatch(/never switch between masculine and feminine mid-reply/);
    });

    it("is the else-branch of the set-gender check, so a set gender still wins", () => {
        const i = SRC.indexOf('if (ug && ug !== "prefer_not" && ug !== "other") {');
        expect(i).toBeGreaterThan(0);
        expect(SRC.indexOf("USER GENDER: not given.")).toBeGreaterThan(i);
        expect(SRC.slice(i, SRC.indexOf("USER GENDER: not given."))).toMatch(/\} else \{\s*\/\/ Measured 26 Oct 2026/);
    });
});
