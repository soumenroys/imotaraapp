// src/__tests__/rtl/logicalProperties.test.ts
// Arabic, Hebrew and Urdu are fully shipped languages, and RtlInit sets
// dir="rtl" for them. Direction-aware CSS (flexbox, default text-align) mirrors
// on its own; physical utilities do not. A single `ml-2` or `right-0` that
// creeps back in is invisible in review and invisible in English, and only
// shows up as a control stuck on the wrong side for an RTL reader.
//
// In LTR these are equivalent (`ms-2` compiles to margin-inline-start, which
// IS margin-left in LTR), so this rule costs LTR users nothing.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// The surface an RTL reader actually navigates. Admin and the org dashboard are
// internal English-only tools and are deliberately not covered.
const FILES = [
  "src/app/chat/page.tsx",
  "src/app/history/page.tsx",
  "src/app/grow/page.tsx",
  "src/app/connect/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/connect/register/page.tsx",
  "src/components/SiteHeader.tsx",
];

// Tailwind utilities are lowercase. Requiring a lowercase/digit/bracket next
// character is what keeps locale codes such as "mr-IN" and "ml-IN" out of this
// — a looser rule rewrote those to "me-IN"/"ms-IN" while this was being built.
const NEXT = "(?=[a-z0-9.\\[])";
const BANNED: [string, RegExp, string][] = [
  ["ml-*", new RegExp(`(?<![\\w-])-?ml-${NEXT}`, "g"), "ms-*"],
  ["mr-*", new RegExp(`(?<![\\w-])-?mr-${NEXT}`, "g"), "me-*"],
  ["pl-*", new RegExp(`(?<![\\w-])-?pl-${NEXT}`, "g"), "ps-*"],
  ["pr-*", new RegExp(`(?<![\\w-])-?pr-${NEXT}`, "g"), "pe-*"],
  ["left-*", new RegExp(`(?<![\\w-])-?left-${NEXT}`, "g"), "start-*"],
  ["right-*", new RegExp(`(?<![\\w-])-?right-${NEXT}`, "g"), "end-*"],
  ["text-left", /(?<![\w-])text-left(?![\w-])/g, "text-start"],
  ["text-right", /(?<![\w-])text-right(?![\w-])/g, "text-end"],
  ["border-l", /(?<![\w-])border-l(?=-[a-z0-9]|["\s`])/g, "border-s"],
  ["border-r", /(?<![\w-])border-r(?=-[a-z0-9]|["\s`])/g, "border-e"],
  ["rounded-l", /(?<![\w-])rounded-l(?=-[a-z0-9]|["\s`])/g, "rounded-s"],
  ["rounded-r", /(?<![\w-])rounded-r(?=-[a-z0-9]|["\s`])/g, "rounded-e"],
];

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("the fixture is real", () => {
  it("every listed file exists and is substantial", () => {
    for (const f of FILES) expect(read(f).length).toBeGreaterThan(500);
  });

  it("the files do use logical utilities, so a pass is not vacuous", () => {
    const all = FILES.map(read).join("\n");
    expect(/(?<![\w-])ms-[a-z0-9.\[]/.test(all)).toBe(true);
    expect(/(?<![\w-])text-start(?![\w-])/.test(all)).toBe(true);
    expect(/(?<![\w-])end-[a-z0-9.\[]/.test(all)).toBe(true);
  });
});

describe("no physical direction utilities on the RTL-facing surface", () => {
  for (const file of FILES) {
    it(`${file} uses logical properties only`, () => {
      const src = read(file);
      const lines = src.split("\n");
      const found: string[] = [];
      for (const [name, re, fix] of BANNED) {
        lines.forEach((line, i) => {
          for (const m of line.matchAll(re)) {
            found.push(`${file}:${i + 1} "${m[0]}" (${name} -> use ${fix})`);
          }
        });
      }
      expect(found).toEqual([]);
    });
  }
});
