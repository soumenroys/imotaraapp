/**
 * #48 (27 Nov 2026): the web chat's own words must exist in all 22 languages.
 * The quick-tap chips, the mood check-in options and the weekly recap fell back to ENGLISH
 * for 7–11 of them (es fr pt ru id ur zh · + ar he de ja for the recap).
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");
const ALL = "en hi bn ta te mr gu pa kn ml or ur ar he ru zh ja es fr de pt id".split(" ");

function keysOf(start: string, end: string): Set<string> {
    const i = SRC.indexOf(start);
    expect(i).toBeGreaterThan(-1);
    const seg = SRC.slice(i, SRC.indexOf(end, i));
    return new Set([...seg.matchAll(/^\s{2,4}([a-z]{2}):/gm)].map((m) => m[1]));
}

describe("every chat table speaks all 22 languages", () => {
    it.each([
        ["quick-tap chips", "const SENTIMENT_SEEDS_BY_LANG", "\n};"],
        ["mood check-in", "const MOOD_OPTIONS_BY_LANG", "\n};"],
        ["weekly recap", "const RECAP: Record<string, (e: string, c: number) => string> = {", "\n  };"],
    ])("%s", (_name, start, end) => {
        const keys = keysOf(start, end);
        expect(ALL.filter((l) => !keys.has(l))).toEqual([]);
    });
});
