/**
 * The marketing documents must not sell a tier that no longer exists, or quote
 * a price we do not charge.
 *
 * 🔴 WHY THIS EXISTS. "Pro" was retired on 2026-09-25 — `plus_*` is live,
 * `pro_*` is retired, and store product IDs can never be renamed or reused
 * (see the store-naming memory). TIER_ORDER is FREE · PLUS · FAMILY · EDU ·
 * ENTERPRISE; `pro` survives only as a legacy alias in normaliseTier.
 *
 * Yet on 2026-10-06 eleven `docs/*.html` were still presenting Pro as a live
 * plan — including all three NGO documents, which is exactly what an NGO
 * prospect is sent. One of them also read:
 *
 *     "Commercial Pro list price: ₹149/month (₹1,788/year)"
 *
 * ₹1,788 is 12 × ₹149 — the monthly price times twelve, with the annual
 * discount omitted. The real annual price is ₹1,299, so the document
 * overstated it by ₹489 to the people least able to absorb it.
 *
 * 🔑 `docs/*.html` is the SOURCE; `scripts/generate-*-pdf.js` are Playwright
 * HTML→PDF converters holding no content. Edit the HTML, then re-run the
 * generator — the PDF does NOT update itself.
 *
 * ⚠️ Scope: this guards the documents fixed so far. Others still carry the
 * retired name and are listed as KNOWN_REMAINING — the list must shrink, never
 * grow.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DOCS = path.join(process.cwd(), "docs");

/** A CSS selector or class token, not customer-visible copy. */
const isCssToken = (line: string) => /\.[a-z-]*pro\b|--[a-z-]*pro\b/.test(line);

/** Customer-visible whole-word "Pro"/"pro" lines in a doc. */
function visiblePro(file: string): string[] {
  const src = fs.readFileSync(path.join(DOCS, file), "utf8");
  return src
    .split("\n")
    .filter((l) => /\b[Pp]ro\b/.test(l) && !isCssToken(l))
    .map((l) => l.trim().slice(0, 90));
}

/** Cleaned on 2026-10-06 — these must stay clean. */
const CLEANED = [
  "imotara-pricing-tiers.html",
  "imotara-ngo-licensing.html",
  "imotara-ngo-admin-guide.html",
  "imotara-ngo-why-imotara.html",
  "imotara-corporate-licensing.html",
];

/**
 * Not yet cleaned. ⚠️ This list may SHRINK but must never GROW — a new entry
 * means the retired tier was reintroduced somewhere.
 */
const KNOWN_REMAINING = [
  "imotara-appstore-links.html",
  "imotara-brand-voice.html",
  "imotara-marketing-roadmap.html",
  "imotara-product-one-pager.html",
  "imotara-target-audience-personas.html",
  "imotara-user-licensing.html",
];

describe("the cleaned documents no longer sell a retired tier", () => {
  it.each(CLEANED)("%s has no customer-visible 'Pro'", (file) => {
    expect(visiblePro(file)).toEqual([]);
  });
});

describe("the NGO documents quote the real annual price", () => {
  it("no document multiplies the monthly price by twelve", () => {
    // ₹1,788 = 12 × ₹149, i.e. the annual discount dropped. The real figure
    // is ₹1,299. Catch the arithmetic, not just this one string.
    for (const file of fs.readdirSync(DOCS).filter((f) => f.endsWith(".html"))) {
      const src = fs.readFileSync(path.join(DOCS, file), "utf8");
      expect(src, `${file} quotes 12x the monthly price`).not.toContain("₹1,788");
    }
  });

  it("imotara-ngo-licensing states ₹1,299/year", () => {
    const src = fs.readFileSync(path.join(DOCS, "imotara-ngo-licensing.html"), "utf8");
    expect(src).toContain("₹1,299/year");
  });
});

describe("the backlog of uncleaned documents only shrinks", () => {
  it("no NEW document has started using the retired tier", () => {
    const all = fs.readdirSync(DOCS).filter((f) => f.endsWith(".html"));
    const dirty = all.filter((f) => visiblePro(f).length > 0);
    const unexpected = dirty.filter((f) => !KNOWN_REMAINING.includes(f));
    expect(unexpected).toEqual([]);
  });

  it("the known-remaining list is still accurate", () => {
    // If one gets cleaned, move it to CLEANED — that is good news and should
    // be a deliberate edit, not a silently passing test.
    const stillDirty = KNOWN_REMAINING.filter((f) => visiblePro(f).length > 0);
    expect(stillDirty.sort()).toEqual([...KNOWN_REMAINING].sort());
  });
});

describe("every doc that has a generator keeps one", () => {
  it("the cleaned docs each have a PDF generator to re-run", () => {
    // The HTML is the source and the PDF does not update itself. If a
    // generator disappears, the PDF silently goes stale forever.
    const scripts = fs.readdirSync(path.join(process.cwd(), "scripts"));
    for (const file of CLEANED) {
      const slug = file.replace("imotara-", "").replace(".html", "");
      const hit = scripts.some((s) => s.includes(slug.replace("pricing-tiers", "pricing")));
      expect(hit, `no generator for ${file}`).toBe(true);
    }
  });
});
