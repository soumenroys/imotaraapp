/**
 * The "Imotara for <audience>" sales PDFs must stay derivable from the live
 * pages, so their prices cannot drift from what we actually charge.
 *
 * 🔴 WHY THIS EXISTS. Ten PDFs sat in ~/Documents/Imotara/Sales as one-off
 * exports with no link back to anything. On 2026-10-06 six of them still quoted
 * "₹99/month or ₹699/year" — pricing retired on 2026-09-25 — so a prospect sent
 * one would have met a ~50% higher price at checkout. Five also still named the
 * retired tier.
 *
 * Nothing could have caught it: the files lived outside the repo, and the one
 * guard that reads documents (marketingDocsNoRetiredTier) only opens docs/*.html.
 *
 * ✅ The fix was to stop hand-maintaining them. scripts/generate-audience-sales-pdfs.js
 * renders /for/<slug>, whose prices come from PRODUCT_CATALOG via
 * src/data/audiencePages.ts — and audiencePages.test.ts already pins that the
 * retired annual price can never be advertised there.
 *
 * ⚠️ This test does NOT read the PDFs. Binary artefacts are not in the repo and
 * pdftotext is not a dependency worth adding. What it pins is the CHAIN: every
 * audience that exists has an output filename, the generator renders pages
 * rather than hardcoding copy, and it fails loudly on a partial run — because a
 * half-rebuilt sales folder is worse than an obviously failed one.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const GEN  = () => read("scripts/generate-audience-sales-pdfs.js");
const DATA = () => read("src/data/audiencePages.ts");

/** Slugs defined in the app's own audience data. */
function definedSlugs(): string[] {
  return [...DATA().matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

/** Slugs the generator knows how to name a file for. */
function generatorSlugs(): string[] {
  const src = GEN();
  const block = src.slice(src.indexOf("const AUDIENCES"), src.indexOf("};", src.indexOf("const AUDIENCES")));
  return [...block.matchAll(/'([a-z0-9-]+)':/g)].map((m) => m[1]);
}

describe("every audience the site serves has a sales PDF", () => {
  it("🔑 the generator covers every slug in audiencePages.ts", () => {
    // A new audience page with no entry here would silently never get a PDF,
    // and the gap would only show up as a missing file nobody looked for.
    const missing = definedSlugs().filter((s) => !generatorSlugs().includes(s));
    expect(missing).toEqual([]);
  });

  it("and names no audience the site does not have", () => {
    const extra = generatorSlugs().filter((s) => !definedSlugs().includes(s));
    expect(extra).toEqual([]);
  });

  it("covers all ten — the set the business actually sends", () => {
    expect(generatorSlugs()).toHaveLength(10);
  });
});

describe("the PDFs are rendered, not re-typed", () => {
  it("🔴 renders /for/<slug> rather than embedding its own copy", () => {
    // The moment this script starts holding its own prices or prose, it becomes
    // the eleventh stale artefact instead of the cure for the other ten.
    //
    // ⚠️ Comments are stripped first. The header explains the ₹99/₹699 history
    // this script exists to end, and a naive check flagged that explanation as
    // if it were embedded pricing — assert the CODE, not the mention.
    const src = GEN();
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/\$\{BASE\}\/for\/\$\{slug\}/);
    expect(code).not.toMatch(/₹\s?\d/);
  });

  it("a partial run fails, so nobody ships a half-updated folder", () => {
    const src = GEN();
    expect(src).toMatch(/process\.exit\(failed \? 1 : 0\)/);
  });

  it("a non-OK response is an error, not an empty PDF", () => {
    // Rendering a 404 page to PDF would produce a plausible-looking file that
    // says nothing — the worst failure mode here.
    expect(GEN()).toMatch(/if \(!res \|\| !res\.ok\(\)\) throw/);
  });

  it("is runnable as a named script, not a remembered command", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["docs:sales"]).toContain("generate-audience-sales-pdfs.js");
  });
});
