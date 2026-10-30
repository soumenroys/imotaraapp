// 🔑 Owner, 30 Oct 2026: "We will not mention 'AI companion' — instead we will
// project Imotara as Private Companion." Every public surface — pages, page
// data, blog, Help Centre (and the help bot that reads it), llms.txt.
// Code comments may still name the old phrase to explain the change.
// ⚠️ The chat still says "Replies come from software, not a person." —
// ⇒ chatSaysSoftwareNotPerson.test.ts. Positioning changed; honesty did not.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app", "src/data", "src/content", "src/components", "public/llms.txt"];

function files(p: string): string[] {
  const abs = join(process.cwd(), p);
  if (statSync(abs).isFile()) return [p];
  return readdirSync(abs).flatMap((n) => files(join(p, n)));
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line) || /\{\/\*.*\*\/\}/.test(line);

describe('no "AI companion" on any public surface', () => {
  const hits = ROOTS.flatMap(files)
    .filter((f) => /\.(tsx?|md|json|txt)$/.test(f))
    .flatMap((f) =>
      readFileSync(join(process.cwd(), f), "utf8")
        .split("\n")
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => /\bAI[ -]companion/i.test(line) && !isComment(line))
        // web addresses keep their old slug so existing links still work
        .filter(({ line }) => !/\/compare\/ai-companion-vs-|"ai-companion-vs-|\| "ai-companion-vs-/.test(line.replace(/label: "[^"]*"/, "")))
        .map(({ f, i, line }) => `${f}:${i}  ${line.trim().slice(0, 120)}`),
    );

  it("finds none", () => {
    expect(hits).toEqual([]);
  });
});
