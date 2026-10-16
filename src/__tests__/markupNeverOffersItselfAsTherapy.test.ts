/**
 * ⛔ THE MARKUP MUST NOT OFFER IMOTARA AS A SUBSTITUTE FOR THERAPY.
 *
 * 🔴 THE DEFECT THIS PINS, found 2026-10-17. The site-wide metadata carried
 * the keyword "therapy alternative companion", and the MobileApplication
 * schema carried "therapy alternative" — while the Organization node, forty
 * lines away in the same file, said:
 *
 *     "It is not therapy, it does not diagnose, and it is not a crisis service."
 *
 * and the consent gate says the same thing in 22 languages before anyone can
 * use the product at all.
 *
 * 🔑 WHY MARKUP IS THE WORST PLACE FOR IT. A page can hold a nuanced
 * comparison — /compare/ai-companion-vs-human-counsellor exists precisely to
 * explain the difference, at length, with the caveats attached. A keyword
 * cannot. An assistant lifts it with no page around it, and "therapy
 * alternative" then IS the claim. On a mental-health product that is both a
 * false statement and the liability surface.
 *
 * ⚠️ This is the fourth time marketing copy has drifted into a claim the
 * product's own spec denies ⇒ trap_marketing_copy_claims_a_regulated_title.
 * The spec was right every time; the marketing moved.
 *
 * ⛔ WHAT THIS DOES NOT FORBID. Discussing therapy is fine and necessary —
 * naming it, comparing against it, telling someone to seek it. The ban is on
 * the site OFFERING ITSELF as a replacement for it.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * ⚠️ Comments stripped before asserting. This file's own header quotes the
 * banned phrase, and the guards in layout.tsx explain themselves in prose. A
 * check that reads its own explanation is the mutation-proof failure we have
 * now hit three times ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
 */
const stripComments = (src: string) =>
    src
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

/** Phrases that position this product as a stand-in for professional care. */
const SUBSTITUTE_CLAIMS = [
    "therapy alternative",
    "alternative to therapy",
    "replace therapy",
    "replacement for therapy",
    "instead of therapy",
    "therapy at home",
    "online therapist",
    "ai therapist",
    "free therapy",
];

/** Surfaces a machine reads without the page around it. */
const MACHINE_READ = [
    "src/app/layout.tsx",
    "public/llms.txt",
    "public/site.webmanifest",
];

describe("no surface offers Imotara as a substitute for therapy", () => {
    for (const file of MACHINE_READ) {
        it(`${file} carries no substitute claim`, () => {
            const body = stripComments(fs.readFileSync(path.join(ROOT, file), "utf8")).toLowerCase();
            const hits = SUBSTITUTE_CLAIMS.filter((c) => body.includes(c));
            expect(hits, `${file} offers the product as a stand-in for therapy: ${hits.join(", ")}`).toEqual([]);
        });
    }

    it("blog tags describe the topic, not the product", () => {
        // Tags are not inert: they become the post's `keywords`, its schema
        // and a visible chip. A tag reading "therapy alternative" on an
        // article explaining that Imotara is NOT one contradicts the article.
        const dir = path.join(ROOT, "src/content/blog");
        const offenders: string[] = [];
        for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
            const tagLine = /tags:\s*\[([^\]]*)\]/.exec(fs.readFileSync(path.join(dir, f), "utf8"));
            if (!tagLine) continue;
            const lower = tagLine[1].toLowerCase();
            for (const c of SUBSTITUTE_CLAIMS) if (lower.includes(c)) offenders.push(`${f}: ${c}`);
        }
        expect(offenders, `tags claiming to be therapy: ${offenders.join(" | ")}`).toEqual([]);
    });

    it("⛔ still says plainly that it is NOT therapy — removal is not the fix", () => {
        // A guard that only deletes words would pass on a page that says
        // nothing at all. The disclaimer has to survive too.
        const layout = fs.readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
        const start = layout.indexOf("const organization = {");
        const org = stripComments(layout.slice(start, layout.indexOf("const website = {", start)));
        expect(org).toContain("It is not therapy");
        expect(org).toContain("not a crisis service");
    });
});
