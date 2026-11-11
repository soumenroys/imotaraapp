// src/__tests__/homeHeadlineMatchesTitle.test.ts
// Owner, 8 Nov 2026: the homepage headline "An Immortal Friend for Your Emotions" ⇒
// "A Private Place for How You Really Feel" — the same words as the store listings and
// social posts. The tab/search/share title must say the same thing, from ONE constant.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("homepage headline and brand title say the same thing", () => {
  const page = read("src/app/HomeClient.tsx");
  const layout = read("src/app/layout.tsx");

  it("the hero reads 'A Private Place / for How You Really Feel'", () => {
    expect(page).toMatch(/A Private Place\s*<br \/>[\s\S]{0,200}for How You Really Feel/);
  });

  it("the title is one constant, used by the tab, the share card and the X card", () => {
    expect(layout).toMatch(/const BRAND_TITLE = "Imotara — A Private Place for How You Really Feel";/);
    const code = layout.replace(/^\s*\/\/.*$/gm, "");
    expect((code.match(/BRAND_TITLE/g) ?? []).length).toBe(5); // 1 declaration + 4 uses
  });

  it("⛔ the old 'immortal friend' line is gone from the hero and the title", () => {
    expect(page).not.toMatch(/Immortal Friend/i);
    expect(layout.replace(/^\s*\/\/.*$/gm, "")).not.toMatch(/Immortal Friend/i);
  });
});
