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
const isCssToken = (line: string) =>
  // A selector (.tier-pro), a custom property (--brand-pro), OR a class
  // ATTRIBUTE VALUE (class="tier-badge tier-pro"). The last form has no
  // leading dot and was missed, so a correctly-labelled "Plus" badge still
  // tripped the check because of its class name.
  /\.[a-z-]*pro\b|--[a-z-]*pro\b|class="[^"]*\bpro\b[^"]*"|[a-z]+-pro\b/.test(line);

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
  "imotara-user-licensing.html",
  "imotara-product-one-pager.html",
  "imotara-brand-voice.html",
  "imotara-marketing-roadmap.html",
];

/**
 * Not yet cleaned. ⚠️ This list may SHRINK but must never GROW — a new entry
 * means the retired tier was reintroduced somewhere.
 */
/**
 * ⛔ NOT a backlog — these two say "Pro" and are CORRECT.
 *
 * Checking contexts before replacing caught them: a blind find-and-replace
 * across the docs would have produced "iPhone 15 Plus" and a persona called
 * "Urban Plus". The retired TIER is gone from every document; what remains is
 * ordinary English and a hardware name.
 *
 * ⚠️ So this list should stay EMPTY of tier references. If a doc ever appears
 * here for a genuine tier use, that is a regression, not an addition.
 */
const LEGITIMATE_PRO = [
  "imotara-appstore-links.html",        // "iPhone 15 Pro" — Apple's device name
  "imotara-target-audience-personas.html", // "Urban Pro" — a persona, i.e. urban professional
];

const KNOWN_REMAINING: string[] = [];

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
    const unexpected = dirty.filter(
      (f) => !KNOWN_REMAINING.includes(f) && !LEGITIMATE_PRO.includes(f),
    );
    expect(unexpected).toEqual([]);
  });

  it("the known-remaining list is still accurate", () => {
    // If one gets cleaned, move it to CLEANED — that is good news and should
    // be a deliberate edit, not a silently passing test.
    const stillDirty = KNOWN_REMAINING.filter((f) => visiblePro(f).length > 0);
    expect(stillDirty.sort()).toEqual([...KNOWN_REMAINING].sort());
  });
});

describe("every cleaned doc has a generator to re-run", () => {
  // ⚠️ An explicit map, not a slug heuristic. The filenames do not follow one
  // rule — imotara-product-one-pager.html is built by generate-ONE-PAGER-pdf.js,
  // with no "product-". A heuristic silently reported a missing generator for a
  // document that has one.
  const GENERATOR: Record<string, string> = {
    "imotara-pricing-tiers.html":        "generate-pricing-pdf.js",
    "imotara-ngo-licensing.html":        "generate-ngo-licensing-pdf.js",
    "imotara-ngo-admin-guide.html":      "generate-ngo-admin-guide-pdf.js",
    "imotara-ngo-why-imotara.html":      "generate-ngo-why-imotara-pdf.js",
    "imotara-corporate-licensing.html":  "generate-corporate-licensing-pdf.js",
    "imotara-user-licensing.html":       "generate-user-licensing-pdf.js",
    "imotara-product-one-pager.html":    "generate-one-pager-pdf.js",
    "imotara-brand-voice.html":          "generate-brand-voice-pdf.js",
    "imotara-marketing-roadmap.html":    "generate-marketing-roadmap-pdf.js",
  };

  it.each(CLEANED)("%s has a known generator, and it exists", (file) => {
    const gen = GENERATOR[file];
    expect(gen, `no generator mapped for ${file}`).toBeTruthy();
    expect(fs.existsSync(path.join(process.cwd(), "scripts", gen))).toBe(true);
  });
});

/**
 * 🔴 NOT EVERY DOC IS EDITED THE SAME WAY, AND GETTING THIS WRONG IS SILENT.
 *
 * The standing rule said "docs/*.html is the SOURCE; generate-*-pdf.js are
 * Playwright HTML→PDF converters with no content". That is true for 12 of the
 * 17 generators. FIVE of them BUILD the HTML and write it:
 *
 *     fs.writeFileSync(htmlPath, html, 'utf8')
 *
 * For those the SCRIPT is the source. Editing the HTML appears to work — the
 * file changes, the edit is right there — and is then silently reverted the
 * next time anyone regenerates. That happened on 2026-10-06: two documents were
 * "fixed", regenerated, and came out unchanged, with the PDFs rebuilt from the
 * ORIGINAL text.
 *
 * This test exists so the distinction is discoverable from the test suite
 * rather than from losing an edit.
 */
describe("the two kinds of generator are known and distinguished", () => {
  const SCRIPTS = path.join(process.cwd(), "scripts");

  /** Does this generator WRITE the html (script is source) or only read it? */
  const writesHtml = (file: string) =>
    /writeFileSync\([^)]*(htmlPath|\.html)/.test(fs.readFileSync(path.join(SCRIPTS, file), "utf8"));

  // Edit the SCRIPT for these. Editing docs/*.html is reverted on regeneration.
  const SCRIPT_IS_SOURCE = [
    "generate-appstore-pdf.js",
    "generate-brand-voice-pdf.js",
    "generate-competitor-pdf.js",
    "generate-marketing-roadmap-pdf.js",
    "generate-personas-pdf.js",
  ];

  it("the script-is-source list is accurate", () => {
    for (const f of SCRIPT_IS_SOURCE) {
      expect(writesHtml(f), `${f} no longer writes HTML — move it to converters`).toBe(true);
    }
  });

  it("no OTHER generator has quietly started writing HTML", () => {
    const all = fs.readdirSync(SCRIPTS).filter((f) => /^generate-.*pdf.*\.js$/.test(f));
    const surprises = all.filter((f) => writesHtml(f) && !SCRIPT_IS_SOURCE.includes(f));
    // If this fails, someone's HTML edit is about to be silently reverted.
    expect(surprises).toEqual([]);
  });
});
