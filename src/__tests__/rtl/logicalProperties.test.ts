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

/**
 * The same source with COMMENTS BLANKED, line numbers preserved.
 *
 * 🔴 WHY. This guard used to scan raw source, which meant it forbade you from
 * DESCRIBING the thing it guards. On 2026-10-10 a comment on the crisis banner
 * reading "right-to-left languages" and "left-aligned Arabic" failed the rule
 * three times — no CSS involved, just prose.
 *
 * ⚠️ And this file is where that is most likely: the phrase "right-to-left" is
 * near-unavoidable in comments on RTL-facing code. A rule that fires on its own
 * subject matter trains people to work around it, which is how a real `ml-2`
 * eventually slips through next to a `// eslint-disable`-shaped excuse.
 *
 * 🔑 Lines are BLANKED, not removed, so the reported line numbers still point
 * at the real line.
 *
 * ⛔ Only `/* … *\/` blocks and lines whose TRIMMED start is `//` or `*` are
 * blanked. A `//` mid-line is left alone on purpose — truncating there would
 * eat the rest of a line that may hold a real violation, and `"https://…"`
 * would trigger it constantly.
 */
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => (/^\s*(\/\/|\*)/.test(line) ? "" : line))
    .join("\n");

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
      // ⚠️ CODE ONLY — see stripComments. Prose about direction is not a
      // violation, and on these files it is unavoidable.
      const lines = stripComments(read(file)).split("\n");
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

describe("⛔ stripping comments must not gut the rule", () => {
  // 🔑 The risk of the fix above: blanking too much and passing vacuously.
  it("a real violation in CODE is still caught", () => {
    const sample = [
      'const a = <div className="ml-2" />;',
      'const b = <div className="text-right" />;',
    ].join("\n");
    const hits: string[] = [];
    for (const [name, re] of BANNED) {
      for (const line of stripComments(sample).split("\n")) {
        for (const m of line.matchAll(re)) hits.push(`${name}:${m[0]}`);
      }
    }
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("…while the same text in a COMMENT is ignored", () => {
    const sample = [
      '// these are right-to-left languages, rendered left-aligned',
      '/* ml-2 and text-right are mentioned here in prose */',
      ' * a continuation line about left-to-right order',
    ].join("\n");
    const hits: string[] = [];
    for (const [, re] of BANNED) {
      for (const line of stripComments(sample).split("\n")) {
        for (const m of line.matchAll(re)) hits.push(m[0]);
      }
    }
    expect(hits).toEqual([]);
  });

  it("⚠️ a URL with // mid-line is NOT truncated", () => {
    // The reason only line-leading comments are blanked.
    const sample = 'const u = "https://example.com/x"; const c = "ml-2";';
    const out = stripComments(sample);
    expect(out).toContain("ml-2");
  });

  it("line numbers survive the strip", () => {
    const sample = "// comment\nconst a = 1;\n/* block */\nconst b = 2;";
    expect(stripComments(sample).split("\n")).toHaveLength(4);
  });
});
