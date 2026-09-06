// src/__tests__/settings/settingsSections.test.ts
// Settings search sends people to a section by id and names it by title. If
// either drifts from the page, search either silently does nothing (an id no
// section listens for) or scrolls nowhere (a title no heading matches).
//
// Neither failure is visible in review, and the equivalent drift had already
// happened on mobile — companion_reactions claimed one section while rendering
// in another — so this reads both facts out of page.tsx rather than trusting
// the catalogue.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SETTINGS_SECTIONS, searchSettingsSections } from "@/data/settingsSections";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/settings/page.tsx"), "utf8");

/** Section ids the page actually registers, via useSectionOpen("id", …). */
function idsOnPage(): string[] {
    return [...SRC.matchAll(/useSectionOpen\("([a-z-]+)"/g)].map((m) => m[1]).sort();
}

/** Titles the page actually renders, from every SectionToggleHeader. */
function titlesOnPage(): string[] {
    const out: string[] = [];
    for (const m of SRC.matchAll(/<SectionToggleHeader\s+([\s\S]{0,900}?)\/>/g)) {
        const inline = /title="([^"]+)"/.exec(m[1]);
        if (inline) { out.push(inline[1]); continue; }
        // Multi-line titles wrap the text in JSX; take the first real text line.
        const jsx = /title=\{([\s\S]*?)\}\s*\n/.exec(m[1]);
        if (jsx) {
            const line = jsx[1].split("\n").map((l) => l.trim())
                .find((l) => l && !l.startsWith("<") && !l.startsWith("}"));
            if (line) out.push(line.replace(/&amp;/g, "&"));
        }
    }
    return out;
}

describe("the fixture is real", () => {
    it("reads sections out of the actual settings page", () => {
        expect(SRC.length).toBeGreaterThan(50_000);
        expect(idsOnPage().length).toBeGreaterThanOrEqual(25);
        expect(titlesOnPage().length).toBeGreaterThanOrEqual(25);
    });
});

describe("every catalogue entry matches the page", () => {
    it("covers every section the page registers, and invents none", () => {
        const onPage = idsOnPage();
        const inCatalogue = SETTINGS_SECTIONS.map((s) => s.id).sort();
        expect(inCatalogue).toEqual(onPage);
    });

    it("names each section the way the page titles it", () => {
        const titles = titlesOnPage().map((t) => t.replace(/\s+/g, " ").trim());
        for (const s of SETTINGS_SECTIONS) {
            expect(titles, `no heading matches "${s.title}"`).toContain(s.title);
        }
    });

    it("has no duplicate ids", () => {
        const ids = SETTINGS_SECTIONS.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("the page listens for the open event, or nothing can be opened", () => {
        expect(SRC).toContain("OPEN_SECTION_EVENT");
        expect(SRC).toMatch(/addEventListener\(OPEN_SECTION_EVENT/);
    });
});

describe("search finds the obvious things", () => {
    it.each([
        ["timeout", "network"],
        ["dark mode", "appearance"],
        ["text size", "appearance"],
        ["export", "export-data"],
        ["crisis", "safety-crisis"],
        ["delete my account", "delete-account"],
        ["notifications", "browser-notifications"],
    ])("%s -> %s", (query, expected) => {
        const top = searchSettingsSections(query)[0];
        expect(top, `no result for "${query}"`).toBeTruthy();
        expect(top.id).toBe(expected);
    });

    it("returns nothing for an empty query", () => {
        expect(searchSettingsSections("")).toEqual([]);
        expect(searchSettingsSections("   ")).toEqual([]);
    });

    it("returns nothing rather than noise for a query that matches nothing", () => {
        expect(searchSettingsSections("zzzzqqqq")).toEqual([]);
    });
});
