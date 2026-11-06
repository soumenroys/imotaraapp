// src/__tests__/seo/oneBrandInATitle.test.ts
// 🔴 6 Nov 2026: Google showed "How to stop overthinking at night — Imotara · Imotara".
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { brandTitle } from "@/lib/seo/brandTitle";

describe("brandTitle", () => {
  it("a title that names Imotara is absolute — the template cannot add a second", () => {
    expect(brandTitle("How to stop overthinking at night — Imotara")).toEqual({ absolute: "How to stop overthinking at night — Imotara" });
  });
  it("any other title is left for the template to brand once", () => {
    expect(brandTitle("Blog")).toBe("Blog");
  });
});

describe("every page title", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(n)) files.push(p); } };
  walk("src/app");

  it("⛔ no metadata title literal names Imotara without brandTitle()", () => {
    const offenders = files.filter((f) => /^ {2}title: "[^"\n]*Imotara/m.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("⛔ the generated pages (answers, compare, for) wrap their metaTitle", () => {
    for (const f of ["src/app/answers/[slug]/page.tsx", "src/app/compare/[slug]/page.tsx", "src/app/for/[audience]/page.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/title: brandTitle\(page\.metaTitle\)/);
    }
  });

  it("the template is still there for titles that do not name the brand", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(/template: "%s · Imotara"/);
  });
});
