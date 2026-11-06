// src/__tests__/seo/llmsFullTxt.test.ts — /llms-full.txt (404 until 6 Nov 2026).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { llmsFullText } from "@/lib/seo/llmsFull";
import { ANSWER_PAGES } from "@/data/answerPages";
import { COMPARE_PAGES } from "@/data/comparePages";

const LLMS = readFileSync("public/llms.txt", "utf8");
const FULL = llmsFullText(LLMS);

describe("/llms-full.txt", () => {
  it("starts with llms.txt — minus the HTML note, which is written to us, not to a model", () => {
    expect(FULL.startsWith("# Imotara")).toBe(true);
    expect(FULL).not.toContain("<!--");
    expect(FULL).not.toContain("NOTHING UNTRUE MAY APPEAR");
  });
  it("carries every answer and comparison page, each with its source URL", () => {
    for (const p of Object.values(ANSWER_PAGES)) {
      expect(FULL).toContain(`### ${p.question}`);
      expect(FULL).toContain(`https://www.imotara.com/answers/${p.slug}`);
    }
    for (const p of Object.values(COMPARE_PAGES)) {
      expect(FULL).toContain(`https://www.imotara.com/compare/${p.slug}`);
    }
  });
  it("⛔ says nothing the pages don't — every line after llms.txt is a fixed heading, a source link, or page data", () => {
    const FIXED = new Set(["---", "## Answers to common questions", "## Comparisons", "#### Things to try now", "#### When to get more help", "#### Who it is not for", "|---|---|---|"]);
    const DATA = JSON.stringify([ANSWER_PAGES, COMPARE_PAGES]);
    const tail = FULL.slice(FULL.indexOf("\n---\n"));
    const stray = tail.split("\n").filter(Boolean).filter((line) => {
      if (FIXED.has(line) || line.startsWith("Source: https://www.imotara.com/")) return false;
      const cells = line.startsWith("|") ? line.split("|").map((c) => c.trim()).filter(Boolean) : [line.replace(/^(#{3,4} |- )/, "")];
      return !cells.every((c) => DATA.includes(JSON.stringify(c).slice(1, -1)));
    });
    expect(stray).toEqual([]);
  });

  it("is served as plain text and built once", () => {
    const route = readFileSync("src/app/llms-full.txt/route.ts", "utf8");
    expect(route).toMatch(/export const dynamic = "force-static"/);
    expect(route).toMatch(/text\/plain/);
  });
});
