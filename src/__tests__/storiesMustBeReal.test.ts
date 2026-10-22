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

describe("🔑 English + Indian languages tell only CHECKED stories", () => {
  it("the cloud is handed checked stories and told to add nothing", () => {
    expect(src).toContain("verifiedStoriesFor(");
    expect(src).toMatch(/The ONLY stories you may tell are the checked ones below/);
    expect(src).toMatch(/never project the user's situation onto the character/);
    expect(src).toMatch(/THE LESSON IS YOURS, NOT THE CHARACTER'S/);
  });
});

describe("the checked collection", () => {
  it("removed stories stay removed", async () => {
    const eng = readFileSync(join(process.cwd(), "src/lib/ai/orchestrator/mythologyEngine.ts"), "utf8")
      .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); // the header names what was removed
    for (const gone of ["mother crow", "two oxen", "a turtle crossing", "deer stood for hours", "even Rama could not sleep", "tales of King Vikramaditya", "a woman offered him food", "Yashodhara woke"])
      expect(eng, gone).not.toContain(gone);
    expect(eng).toContain("only young Vikarna spoke up");
  });
  it("hands two stories per feeling for Bengali, none for unchecked languages", async () => {
    const { verifiedStoriesFor } = await import("@/lib/ai/orchestrator/mythologyEngine");
    expect(verifiedStoriesFor("bn", 7)).toHaveLength(8);
    expect(verifiedStoriesFor("en", 7)).toHaveLength(8);
    expect(verifiedStoriesFor("ar", 7)).toBeNull();
  });
  it("skips a figure already used in the conversation", async () => {
    const { verifiedStoriesFor } = await import("@/lib/ai/orchestrator/mythologyEngine");
    for (let seed = 0; seed < 40; seed++)
      for (const v of verifiedStoriesFor("en", seed, ["Karna"])!) expect(v.text).not.toMatch(/Karna/);
  });
});

describe("Bengali address form", () => {
  it("⛔ তুই only when the user used it first or is a teen", () => {
    expect(src).toMatch(/Never use তুই with someone who has not used it first/);
  });
});
