/**
 * 🔴 22 Oct 2026, measured on the live 1.5.9 app: two of three emotional
 * replies invented Mahabharata material — an episode (Bhima set impossible
 * tasks, "Now do just a bit more") and a reported saying ("যুধিষ্ঠির
 * বলেছিল…"). The quote rule existed but named only some figures and only
 * direct quotes. This pins the broader rule INSIDE the block that asks for
 * stories, so it travels with the request and cannot be dropped alone.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");

describe("stories from epics and scripture must be real", () => {
  const start = src.indexOf('"MYTHOLOGY AND WISDOM STORIES');
  const end = src.indexOf("].join(", start);
  const block = src.slice(start, end);

  it("the story block carries a STORY ACCURACY rule", () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain("CRITICAL — STORY ACCURACY");
  });

  it("⛔ it forbids invented episodes AND reported sayings, for every figure", () => {
    expect(block).toMatch(/NEVER invent an episode/);
    expect(block).toMatch(/direct OR reported/);
    expect(block).toMatch(/EVERY figure/);
  });

  it("no story beats a wrong story", () => {
    expect(block).toMatch(/a reply without a story is always better than a reply with a wrong one/);
  });
});
