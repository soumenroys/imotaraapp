// Every page that defines its own `openGraph` must also carry an image.
//
// 🔴 THE DEFECT, MEASURED IN PRODUCTION 2026-10-16. Next.js does not MERGE a
// page's `openGraph` with the root layout's — it REPLACES it. Ten page files
// set `openGraph: { title, description, url }` and nothing else, and so
// silently dropped the site-wide image:
//
//     /                       og:image = og-image.png  ✅
//     /faq                    og:image = MISSING       ❌
//     /answers                og:image = MISSING       ❌
//     /compare                og:image = MISSING       ❌
//     /answers/grief-and-loss og:image = MISSING       ❌
//
// Every page built that day FOR being shared rendered as a bare grey box when
// pasted into LinkedIn, X or WhatsApp. Nothing failed and nothing warned — and
// the homepage, the one page anyone spot-checks, was fine, which is exactly
// why it survived so long.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const APP = path.join(__dirname, "..", "app");

/** Every .tsx under src/app, recursively. */
function pageFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...pageFiles(full));
        else if (entry.name.endsWith(".tsx")) out.push(full);
    }
    return out;
}

describe("⛔ an openGraph block without an image", () => {
    const files = pageFiles(APP);

    it("finds pages to check at all", () => {
        // Guards the guard: a glob that silently matches nothing would make
        // every assertion below vacuously true.
        expect(files.length).toBeGreaterThan(20);
    });

    it("exists nowhere in src/app", () => {
        const offenders: string[] = [];
        for (const file of files) {
            const src = fs.readFileSync(file, "utf8");
            if (!src.includes("openGraph:")) continue;
            // ⚠️ CHECK THE SPREAD, NOT THE IDENTIFIER. My first version tested
            // `src.includes("OG_IMAGE")`, which the IMPORT LINE satisfies on
            // its own — so deleting `...OG_IMAGE` from the openGraph block
            // still passed. A guard that cannot fail is worse than no guard.
            // Caught by mutation: removing the spread from /compare was green.
            const ok = /\.\.\.OG_IMAGE/.test(src) || /images\s*:/.test(src);
            if (!ok) offenders.push(path.relative(APP, file));
        }
        expect(offenders, "these pages define openGraph but no image").toEqual([]);
    });
});

describe("the shared OG image", () => {
    it("is an absolute URL", async () => {
        const { OG_IMAGE_URL, OG_IMAGE } = await import("@/lib/seo/ogImage");
        // Several crawlers will not resolve a relative og:image.
        expect(OG_IMAGE_URL).toMatch(/^https:\/\//);
        expect(OG_IMAGE.images[0].url).toBe(OG_IMAGE_URL);
    });

    it("declares the dimensions crawlers use to lay the card out", async () => {
        const { OG_IMAGE } = await import("@/lib/seo/ogImage");
        expect(OG_IMAGE.images[0].width).toBe(1200);
        expect(OG_IMAGE.images[0].height).toBe(630);
    });
});
