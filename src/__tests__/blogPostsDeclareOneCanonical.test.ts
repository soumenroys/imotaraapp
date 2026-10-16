/**
 * A blog post must say which URL it is.
 *
 * 🔴 WHY THIS EXISTS. Search Console, 16 Oct 2026 — these pairs were BOTH in
 * the indexed set:
 *
 *     /blog/alucinacion-digital-manejo-crisis
 *     /blog/alucinacion-digital-manejo-crisis?en=1
 *     /blog/doomscrolling-echo-chambers        (and ?en=1)
 *     /blog/confidentialite-exploration-emotionnelle (and ?en=1)
 *     /blog/ai-cultural-bias-discrimination    (and ?en=1)
 *
 * The route set no `alternates` at all, while eight other routes set a
 * canonical. So Google saw two unrelated URLs per article and split the ranking
 * signal between them instead of pooling it — on a site whose measured
 * non-brand impressions were approximately one.
 *
 * ⛔ THE FIX IS NOT TO CANONICALISE ?en=1 AWAY. Those are real translations: a
 * non-English post rendered in English, with its own title and description.
 * Collapsing them would delete a page that legitimately serves English readers.
 * The honest relationship is "same article, two languages" — which is hreflang,
 * not canonical.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/** ⚠️ Comments stripped: this file's own notes name every term asserted below. */
const ROUTE = fs
    .readFileSync(path.join(ROOT, "src/app/blog/[slug]/page.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("blog posts declare a canonical", () => {
    it("sets alternates.canonical", () => {
        expect(ROUTE).toMatch(/alternates:\s*\{[\s\S]{0,200}canonical:/);
    });

    it("the canonical is self-referencing, keeping ?en=1 when that is the page shown", () => {
        // ⛔ A canonical that always points at the base URL would tell Google
        // the English translation is a duplicate of the Spanish original.
        expect(ROUTE).toMatch(/canonical:\s*showEnglish\s*\?/);
        expect(ROUTE).toMatch(/\$\{base\}\?en=1/);
    });

    it("pairs the two languages with hreflang instead of discarding one", () => {
        expect(ROUTE).toMatch(/languages:\s*\{/);
    });

    it("only emits hreflang when an English variant actually exists", () => {
        // A monolingual English post has nothing to pair with, and an hreflang
        // pointing at a page that does not differ is worse than none.
        expect(ROUTE).toMatch(/hasEnglishVariant/);
        expect(ROUTE).toMatch(/meta\.languageCode\s*!==\s*"en"[\s\S]{0,40}meta\.titleEn/);
    });
});

describe("the canonical names the www origin", () => {
    /**
     * 🔑 Search Console holds TWO properties for this site — `imotara.com` and
     * `www.imotara.com`. Every indexed URL, the sitemap and `sameAs` use www.
     * A canonical tag naming the bare host would nominate the other property as
     * preferred, which is the one mistake a canonical can make that is worse
     * than having none at all.
     */
    it("defines SITE_URL once, with a www fallback", () => {
        expect(ROUTE).toMatch(/const SITE_URL\s*=/);
        expect(ROUTE).toMatch(/"https:\/\/www\.imotara\.com"/);
    });

    it("has no second origin with a non-www fallback", () => {
        // There used to be a separate `siteUrl` for the JSON-LD that fell back
        // to the bare host, so structured data and the canonical tag could name
        // different hosts on the same page.
        expect(ROUTE).not.toMatch(/\|\|\s*"https:\/\/imotara\.com"/);
    });
});
