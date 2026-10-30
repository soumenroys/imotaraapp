// 🔑 30 Oct 2026 — Bing's URL Inspection: "More than one h1 tag" on the home
// page. The page had one; the consent box in the ROOT LAYOUT had the other,
// so every page on the site had two. A component that renders on every page
// must never bring its own h1 — the page owns that.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("one h1 per page", () => {
  it("the consent box in the root layout has no h1", () => {
    expect(read("src/app/layout.tsx")).toContain("ConsentGate");
    expect(read("src/components/legal/ConsentGate.tsx")).not.toMatch(/<h1[\s>]/);
  });

  it("the consent box is still named by its title", () => {
    const src = read("src/components/legal/ConsentGate.tsx");
    expect(src).toContain('aria-labelledby="consent-title"');
    expect(src).toMatch(/<h2\s+id="consent-title"/);
  });
});
