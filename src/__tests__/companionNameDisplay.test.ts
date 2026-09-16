/**
 * The companion's chosen name is used where the COMPANION speaks; the product
 * name stays where the PRODUCT is meant. Web half of the 2026-09-16 change.
 *
 * "Imotara" is two things wearing one word — the companion's default name AND
 * the brand. Every string here was classified by hand; brand strings are
 * pinned as UNCHANGED as firmly as companion strings are pinned as changed.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const CHAT = strip(read("src/app/chat/page.tsx"));
const REPLY = strip(read("src/app/api/chat-reply/route.ts"));

describe("chat page: companion-voice strings follow the chosen name", () => {
    it("the low-mood hint helper takes the name and both sad hints use it", () => {
        expect(CHAT).toMatch(/function getLocalMoodHint\(text: string, companionName = "Imotara"\)/);
        expect((CHAT.match(/— \$\{companionName\} is here with you\./g) ?? []).length).toBe(2);
        expect(CHAT).toMatch(/getLocalMoodHint\(latestUserMessage\.content, companionDisplayName \|\| "Imotara"\)/);
    });

    it.each([
        ["unsent letter",  /— \{companionDisplayName \|\| "Imotara"\} will/],
        ["grief space",    /Grief &amp; Loss space — \{companionDisplayName \|\| "Imotara"\} will hold/],
        ["trial notice",   /After your trial, \{companionDisplayName \|\| "Imotara"\} continues to work/],
        ["offline card",   /Always here, even offline — \$\{companionDisplayName \|\| "Imotara"\} replies without internet/],
        ["first-time tip", /Just talk — \{companionDisplayName \|\| "Imotara"\} listens without judgment\./],
        ["input label",    /aria-label=\{`Message \$\{companionDisplayName \|\| "Imotara"\}`\}/],
        ["reaction title", /title=\{`\$\{companionDisplayName \|\| "Imotara"\} reacted`\}/],
    ])("%s speaks as the companion", (_l, re) => { expect(CHAT).toMatch(re); });
});

describe("⚠️ chat page: brand strings are UNCHANGED", () => {
    it.each([
        ["privacy explainer", /Imotara analyzes emotions locally in your bro/],
        ["safety disclaimer", /Imotara is a reflection companion, not a substitute for professional support\./],
        ["personalise card",  /Make Imotara yours — personalize your companion's name/],
    ])("%s still says Imotara", (_l, re) => { expect(CHAT).toMatch(re); });
});

describe("chat-reply prompt: the model is told ONE name, consistently", () => {
    it("the effective name is hoisted to the top of the handler", () => {
        // Transcript labels and prompt lines earlier in POST need it; a second
        // definition further down would be the same value declared twice.
        const first = REPLY.indexOf('const effectiveCompanionName = body?.companionName?.trim() || "Imotara";');
        expect(first).toBeGreaterThan(-1);
        expect(REPLY.indexOf('const effectiveCompanionName', first + 10)).toBe(-1);
        expect(first).toBeLessThan(REPLY.indexOf("m.role === \"assistant\""));
    });

    it.each([
        ["history transcript label", /m\.role === "assistant"\s*\?\s*effectiveCompanionName/],
        ["voice-gender instruction",  /when " \+ effectiveCompanionName \+ " speaks in first person/],
        ["humour instruction",        /effectiveCompanionName \+ " should too\. Not forced\./],
        ["final write instruction",   /"Now write " \+ effectiveCompanionName \+ "'s next reply/],
    ])("%s uses the companion's name", (_l, re) => { expect(REPLY).toMatch(re); });

    it("⚠️ brand references in the prompt are UNCHANGED", () => {
        expect(REPLY).toMatch(/Imotara is an Indian product/);
        expect(REPLY).toMatch(/'Imotara Connect'/);
    });
});
