/**
 * 🔴 A RETRY THAT REPEATS THE FAILED RUN IS NOT A RETRY (26 Nov 2026).
 *
 * Instagram, Sun 6 Dec 20:00 IST: 5 runs, 3 drafts each, all refused the same way —
 * an "A reply…" title, then two clashes with "When tiredness doesn't use its own
 * name". Every run started from the identical angle and title form, so retrying
 * every six hours asked the same question and got the same answer.
 *
 * 🔑 Now each failed run moves the starting angle (and title form) on by one, and the
 * last run's objections go to the writer from the first draft.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { retryTurn, angleOrder } from "@/lib/social/pipeline";

describe("retryTurn", () => {
  it("is the post's own turn on the first run (behaviour unchanged)", () => {
    expect(retryTurn(7)).toBe(7);
    expect(retryTurn(7, 0)).toBe(7);
  });
  it("moves on by one per earlier failed run", () => {
    expect(retryTurn(7, 1)).toBe(8);
    expect(retryTurn(7, 5)).toBe(12);
  });
  it("ignores nonsense", () => {
    expect(retryTurn(3, -2)).toBe(3);
    expect(retryTurn(3, Number.NaN)).toBe(3);
  });
  it("so consecutive retries start from different angles", () => {
    const cycle = ["a", "b", "c"];
    expect(angleOrder(cycle, retryTurn(4, 0))[0]).not.toBe(angleOrder(cycle, retryTurn(4, 1))[0]);
  });
});

describe("⛔ and the pipeline actually uses it", () => {
  const CLEAN =
    "Most of the hard hours are not office hours. Imotara is awake then, in whichever of 22 " +
    "languages you think in. It is not therapy and does not pretend to be.";

  const run = async (slotRetry: number, priorObjection?: string) => {
    const { prepareGenerated } = await import("@/lib/social/pipeline");
    const seen: { pool: string; objections?: string[] }[] = [];
    const deps = {
      recentSubjects: async () => [],
      poolUsage: async () => ({}),
      measuredPosts: async () => [],
      usedRecipeHashes: async () => new Set<string>(),
      recentPalettes: async () => [],
      recentLayouts: async () => [],
      overlay: async () => ({}),
      write: async (req: { topicPool: string[]; previousObjections?: string[] }) => {
        seen.push({ pool: req.topicPool[0], objections: req.previousObjections });
        return { subject: `A fresh subject ${slotRetry}`, body: CLEAN, support: "Private by default." };
      },
      rng: () => 0.42,
    };
    const schedule = {
      id: "sched-1",
      name: "Two angles",
      brief: "Say one plain thing.",
      platforms: ["facebook"],
      contentType: "text_graphic",
      contentMix: null,
      topicPool: ["privacy", "offline"],
      tone: "gentle_plain",
      lengthHint: "short",
      languages: ["en"],
      autoPublish: false,
    };
    const r = await prepareGenerated(deps as never, {
      schedule: schedule as never,
      platform: "facebook",
      language: "en",
      postsSoFar: 0,
      slotRetry,
      priorObjection,
    } as never);
    return { r, seen };
  };

  it("🔴 the first draft of a retry is asked from a DIFFERENT angle than the failed run", async () => {
    const first = await run(0);
    const retry = await run(1);
    expect(first.seen[0].pool).not.toBe(retry.seen[0].pool);
  });

  it("🔑 the writer is told why the last run was refused, from the first draft", async () => {
    const { seen } = await run(1, "#2: Subject rejected: clashes with “When tiredness doesn't use its own name”");
    expect(seen[0].objections?.join(" ")).toContain("When tiredness doesn't use its own name");
  });

  it("the first run still starts clean", async () => {
    const { seen } = await run(0);
    expect(seen[0].objections).toBeUndefined();
  });

  it("⛔ the queue cron passes the slot's failure count and reason", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/cron/social-queue/route.ts"), "utf8");
    const at = src.indexOf("await prepareGenerated(deps, {");
    expect(at).toBeGreaterThan(-1);
    const call = src.slice(at, src.indexOf("});", at));
    expect(call).toContain("slotRetry: soFar");
    expect(call).toContain("priorObjection: tried.get(slotKey(want))?.last_error");
  });
});
