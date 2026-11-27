/**
 * No "AI" / "chatbot" in the text users read.
 *
 * Owner rule, 27 Nov 2026: the word "AI" (and "chatbot"/"bot" for Imotara)
 * must not appear anywhere users can see unless it is mandatory. Imotara's
 * own word is "companion". This test scans the user-facing sources that were
 * reworded on that date so the word cannot drift back in unnoticed.
 *
 * Code comments are stripped before scanning — they are not user-visible.
 * Anything that legitimately keeps the word must be listed in ALLOWED below,
 * with the reason. Keep that list explicit and short.
 *
 * NOT scanned on purpose:
 *  - blog essay BODIES: several essays are ABOUT the AI industry (bias,
 *    hallucination, privacy); there the word names the topic, not Imotara.
 *    Only blog titles (title / titleEn) are scanned.
 *  - the privacy policy (src/app/privacy/page.tsx): its "artificial
 *    intelligence models" disclosure is legal wording the owner decides on.
 *  - URL slugs (/ai-emotional-support, /blog/ai-vs-therapy-mental-health …):
 *    they are lowercase "ai-" and rank in search, so they stay.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// Case-sensitive \bAI\b so lowercase URL slugs ("ai-emotional-support",
// faq ids like "ai-app-grief") are not hits; "chatbot" in any case.
const HIT = /\bAI\b|chatbot/i;
const isHit = (line: string) => /\bAI\b/.test(line) || /chatbot/i.test(line);

/** Every allowed line, as file + a substring of that line, with the reason. */
const ALLOWED: { file: string; contains: string; why: string }[] = [
  {
    file: "src/app/ai-emotional-support/page.tsx",
    contains: '"emotional support chatbot"',
    why: "meta keywords entry — not rendered on the page; it matches what people search for",
  },
];

const PAGE_FILES = [
  "src/app/hi/page.tsx",
  "src/app/bn/page.tsx",
  "src/app/ta/page.tsx",
  "src/app/mood-tracker-app/page.tsx",
  "src/app/ai-emotional-support/page.tsx",
  "src/app/connect/age-restricted/page.tsx",
  "src/app/HomeClient.tsx",
  "src/app/blog/page.tsx",
  "src/components/blog/BlogListClient.tsx",
  "src/app/rss.xml/route.ts",
  "src/app/api/org/certificate/route.ts",
  "src/app/api/org/certificate/impact-report/route.ts",
  "src/data/faq.ts",
  "src/data/audiencePages.ts",
];

const HELP_DIR = "src/content/help";
const BLOG_DIR = "src/content/blog";

/** Remove /* … *\/ blocks and // line comments (not the // inside https://). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function hitsIn(file: string, text: string): string[] {
  return text
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => isHit(line))
    .filter(({ line }) => !ALLOWED.some((a) => a.file === file && line.includes(a.contains)))
    .map(({ line, n }) => `${file}:${n}: ${line.trim()}`);
}

describe("no 'AI' / 'chatbot' in user-visible text", () => {
  it("the HIT pattern itself works (control)", () => {
    expect(HIT.test("a private AI companion")).toBe(true);
    expect(isHit("Not a generic chatbot")).toBe(true);
    expect(isHit('href="/ai-emotional-support"')).toBe(false);
  });

  it.each(PAGE_FILES)("%s", (file) => {
    expect(hitsIn(file, stripComments(read(file)))).toEqual([]);
  });

  it("help centre articles (src/content/help/*.md)", () => {
    const files = fs.readdirSync(path.join(ROOT, HELP_DIR)).filter((f) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) => hitsIn(`${HELP_DIR}/${f}`, read(`${HELP_DIR}/${f}`)));
    expect(hits).toEqual([]);
  });

  it("the generated help KB matches (helpKb.json was rebuilt)", () => {
    const kb = read(`${HELP_DIR}/helpKb.json`);
    expect(isHit(kb)).toBe(false);
  });

  it("blog post titles (title / titleEn)", () => {
    const files = fs.readdirSync(path.join(ROOT, BLOG_DIR)).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    const titleLines = files.flatMap((f) =>
      read(`${BLOG_DIR}/${f}`)
        .split("\n")
        .filter((l) => /^\s*(title|titleEn):\s/.test(l))
        .map((l) => `${BLOG_DIR}/${f}: ${l.trim()}`),
    );
    expect(titleLines.length).toBeGreaterThanOrEqual(files.length);
    expect(titleLines.filter((l) => isHit(l) || /\bKI\b|人工智能|الذكاء الاصطناعي|[Yy]apay [Zz]ek/.test(l))).toEqual([]);
  });

  it("every allow-list entry still matches a real line (no stale exemptions)", () => {
    for (const a of ALLOWED) {
      expect(read(a.file), `${a.file} no longer contains ${a.contains} — remove it from ALLOWED`).toContain(a.contains);
    }
  });
});
