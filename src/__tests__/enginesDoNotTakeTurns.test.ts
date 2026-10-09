/**
 * At a tight budget the two engines run ALONGSIDE each other, not in turn.
 *
 * 🔴 WHY, 2026-10-09. OpenAI aborted twice in 24 hours. Sizing the server to
 * the client's budget (981ed26) was right but left the chain SEQUENTIAL —
 * OpenAI for 8.5s, and only then Gemini for 6s. Those cannot both fit in a 10s
 * client budget, so the fallback was dropped.
 *
 * ⚠️ 10s is MOBILE'S DEFAULT. Every mobile user on default settings therefore
 * had NO fallback: when OpenAI aborted they got a hard-coded TEMPLATE rather
 * than a weaker AI reply — exactly the degradation that is not allowed here.
 *
 * ⛔ THE OBVIOUS FIX — raise the timeout — IS THE WRONG ONE. It spends the
 * person's patience to buy a reply, and 20s of typing indicator is a real UX
 * cost paid on every slow request. The budget was never the problem; the
 * SERIALISATION was.
 *
 * 🔑 FIRST USABLE REPLY WINS is the whole policy, and it needs no tie-breaking:
 * if OpenAI can answer in time it answers first and wins, keeping its full
 * window. Gemini only wins when the primary was late — and then the thing it
 * replaces is a template, not an OpenAI reply.
 */

import { describe, it, expect } from "vitest";
import { raceToFirstToken } from "@/lib/imotara/aiClient";
import fs from "fs";
import path from "path";

const code = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const AI = "src/lib/imotara/aiClient.ts";

/** Mirror of planBudget, so the ARITHMETIC is asserted and not just the shape. */
const TOTAL = 14_000, RESERVE = 6_000, PRIMARY = TOTAL - RESERVE;
const OVERHEAD = 1_500, MIN_PRIMARY = 5_000, HEDGE_RESERVE = 3_500, MIN_HEDGE = 2_000;
function plan(clientBudgetMs?: number) {
  if (typeof clientBudgetMs !== "number" || !Number.isFinite(clientBudgetMs) || clientBudgetMs <= 0) {
    return { primaryMs: PRIMARY, fallbackEnabled: true, hedgeAfterMs: null };
  }
  const available = clientBudgetMs - OVERHEAD;
  if (available >= MIN_PRIMARY + RESERVE) {
    return { primaryMs: Math.min(PRIMARY, available - RESERVE), fallbackEnabled: true, hedgeAfterMs: null };
  }
  const primaryMs = Math.max(MIN_PRIMARY, available);
  const h = primaryMs - HEDGE_RESERVE;
  return { primaryMs, fallbackEnabled: false, hedgeAfterMs: h >= MIN_HEDGE ? h : null };
}

describe("🔴 mobile's 10s default now gets a fallback again", () => {
  it("at 10s the engines overlap instead of one being dropped", () => {
    const p = plan(10_000);
    expect(p.hedgeAfterMs).toBe(5_000);
    expect(p.primaryMs).toBe(8_500);
  });

  it("🔑 the primary keeps its ENTIRE window — nothing is taken from it", () => {
    // The whole reply-quality argument. If hedging shortened the primary, every
    // reply OpenAI would have produced between the hedge point and the old
    // deadline would be lost to the weaker model.
    expect(plan(10_000).primaryMs).toBe(8_500);
  });

  it("…and the hedge still leaves Gemini enough time to finish", () => {
    // Gemini measures 1.2–2.6s. The window must clear that, or hedging is theatre.
    const p = plan(10_000);
    expect(p.primaryMs - (p.hedgeAfterMs as number)).toBeGreaterThanOrEqual(2_600);
  });

  it("⚖️ the whole chain still fits what the client will wait for", () => {
    for (const clientMs of [10_000, 12_000]) {
      const p = plan(clientMs);
      expect(p.primaryMs + OVERHEAD).toBeLessThanOrEqual(clientMs);
    }
  });
});

describe("⚠️ SCOPE — the roomy budgets are deliberately untouched", () => {
  it.each([15_000, 20_000, 30_000, 60_000])("at %ims nothing changes", (clientMs) => {
    const p = plan(clientMs);
    expect(p.hedgeAfterMs).toBeNull();      // no hedge
    expect(p.fallbackEnabled).toBe(true);   // the sequential fallback already fits
  });

  it("an older client that sends no header keeps today's behaviour exactly", () => {
    expect(plan(undefined)).toEqual({ primaryMs: 8_000, fallbackEnabled: true, hedgeAfterMs: null });
  });

  it("⛔ a hedge and a sequential fallback are never BOTH on", () => {
    // Both would mean two Gemini calls for one reply.
    for (const c of [undefined, 10_000, 12_000, 15_000, 20_000, 60_000]) {
      const p = plan(c as number | undefined);
      expect(p.hedgeAfterMs !== null && p.fallbackEnabled).toBe(false);
    }
  });
});

describe("🔑 the SOURCE computes it — not just the mirror above", () => {
  // ⚠️ ADDED AFTER MUTATION TESTING. Two mutations survived the first version
  // of this file: planning `hedgeAfterMs: null` unconditionally, and shrinking
  // the primary by HEDGE_RESERVE_MS. Both passed because every budget
  // assertion above runs against this file's OWN mirror of planBudget. A
  // mirror cannot catch a change to the thing it mirrors — the same mistake
  // that let `b663492` ship a false parity claim for six months.
  const s = code(AI);

  it("the hedge point is derived from the primary, not hardcoded", () => {
    expect(s).toMatch(/const hedgeAfterMs = primaryMs - HEDGE_RESERVE_MS;/);
  });

  it("⛔ …and it is actually RETURNED, not computed and dropped", () => {
    expect(s).toMatch(/hedgeAfterMs: hedgeAfterMs >= MIN_HEDGE_AFTER_MS \? hedgeAfterMs : null,/);
  });

  it("🔑 the primary keeps its full window in the SOURCE too", () => {
    // M2: `Math.max(MIN_PRIMARY_MS, available) - HEDGE_RESERVE_MS` would hand
    // every slow-but-not-failing reply to the weaker model.
    expect(s).toMatch(/const primaryMs = Math\.max\(MIN_PRIMARY_MS, available\);/);
  });

  it("the constants are the measured ones", () => {
    expect(s).toMatch(/const HEDGE_RESERVE_MS = 3_500;/);   // Gemini 1.2–2.6s + margin
    expect(s).toMatch(/const MIN_HEDGE_AFTER_MS = 2_000;/);
  });

  it("the roomy branch still returns no hedge", () => {
    expect(s).toMatch(/fallbackEnabled: true,\s*hedgeAfterMs: null,/);
  });
});

describe("🔑 the implementation really overlaps, and really prefers speed", () => {
  const s = code(AI);

  it("both paths consult the hedge and delegate when there is none", () => {
    // ⚠️ UPDATED: the condition gained `|| options.noFallback` (U19), because
    // a hedge is a second engine too and a caller that discards non-OpenAI
    // output must not pay for one speculatively. Still two paths, still
    // delegating when there is no hedge — the guarantee is unchanged.
    expect([...s.matchAll(/if \(plan\.hedgeAfterMs === null \|\| options\.noFallback\)/g)].length)
      .toBeGreaterThanOrEqual(1);
    expect([...s.matchAll(/if \(plan\.hedgeAfterMs === null/g)].length).toBe(2);
    expect(s).toMatch(/return callImotaraAIPrimary\(prompt, options\);/);
    expect(s).toMatch(/yield\* streamImotaraAIPrimary\(prompt, options\);/);
  });

  it("⛔ the primary is NOT cancelled when the hedge starts", () => {
    // Cancelling to "save" a call would discard the better reply exactly when
    // it was about to arrive.
    const win = s.slice(s.indexOf("export async function callImotaraAI"));
    expect(win).not.toMatch(/primaryController\.abort|cancelPrimary|primary\.return\(/);
  });

  it("first USABLE reply wins — an empty one does not", () => {
    // Racing on completion rather than on usable content would let an instant
    // empty failure beat a real reply that was one second away.
    expect(s).toMatch(/function isUsableReply/);
    expect(s).toMatch(/primary\.then\(\(r\) => \(isUsableReply\(r\) \? r : hedge\)\)/);
    expect(s).toMatch(/hedge\.then\(\(r\) => \(isUsableReply\(r\) \? r : primary\)\)/);
  });

  it("💰 the hedge is skipped outright when the primary already answered", () => {
    expect(s).toMatch(/if \(primaryDone\) return/);
    expect(s).toMatch(/\(\) => firstTokenSeen/);
  });

  it("🔑 the streaming race commits to ONE source — tokens are never interleaved", () => {
    const win = s.slice(s.indexOf("export async function* streamImotaraAI"));
    expect(win).toMatch(/while \(winner === null\)/);
    expect(win).toMatch(/yield firstValue;\s*yield\* winner;/);
  });

  it("⚠️ an empty chunk is not treated as content", () => {
    // Committing on an empty string would hand the reply to whichever engine
    // happened to emit a keep-alive first.
    const win = s.slice(s.indexOf("export async function* streamImotaraAI"));
    expect(win).toMatch(/if \(!v\.value\)/);
  });

  it("the loser is closed so its connection is released", () => {
    expect(s).toMatch(/loser\?\.return\(undefined\)/);
  });

  it("⚠️ and both sides finishing empty returns rather than hanging", () => {
    const win = s.slice(s.indexOf("export async function* streamImotaraAI"));
    expect(win).toMatch(/if \(pA === null && pB === null\) return;/);
  });
});

/* ─────────── the race, exercised for real ─────────── */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A stream that emits `tokens`, the first after `firstAfterMs`. */
async function* streamOf(tokens: string[], firstAfterMs: number, gapMs = 1) {
  await wait(firstAfterMs);
  for (const t of tokens) { yield t; await wait(gapMs); }
}

async function collect(g: AsyncGenerator<string, void, unknown>) {
  const out: string[] = [];
  for await (const t of g) out.push(t);
  return out;
}

describe("🔑 raceToFirstToken — the behaviour, not the shape", () => {
  it("the faster engine wins and is the ONLY one drained", async () => {
    const out = await collect(raceToFirstToken(
      streamOf(["A1", "A2", "A3"], 5),
      streamOf(["B1", "B2"], 60),
    ));
    expect(out).toEqual(["A1", "A2", "A3"]);
  });

  it("🔴 the hedge wins when the primary is slow — this is the whole point", async () => {
    const out = await collect(raceToFirstToken(
      streamOf(["A1"], 200),       // the aborting primary
      streamOf(["B1", "B2"], 10),  // Gemini, already warm
    ));
    expect(out).toEqual(["B1", "B2"]);
  });

  it("⛔ tokens from the two engines are NEVER interleaved", async () => {
    // Half a reply in GPT's voice and half in Gemini's would be worse than
    // either alone. Both emit on similar cadences here on purpose.
    const out = await collect(raceToFirstToken(
      streamOf(["A1", "A2", "A3"], 5, 5),
      streamOf(["B1", "B2", "B3"], 6, 5),
    ));
    expect(out.every((t) => t.startsWith("A")) || out.every((t) => t.startsWith("B"))).toBe(true);
    expect(out).toHaveLength(3);
  });

  it("⚠️ an empty keep-alive chunk does not win the race", async () => {
    // The primary emits "" first. If that counted as content it would commit
    // to the primary and the real Gemini tokens would be thrown away.
    const out = await collect(raceToFirstToken(
      streamOf(["", "", "A1"], 1, 80),
      streamOf(["B1", "B2"], 10),
    ));
    expect(out).toEqual(["B1", "B2"]);
  });

  it("a side that finishes empty does not stall the other", async () => {
    const out = await collect(raceToFirstToken(
      streamOf([], 1),              // primary: dies instantly, no tokens
      streamOf(["B1", "B2"], 30),
    ));
    expect(out).toEqual(["B1", "B2"]);
  });

  it("both finishing empty returns cleanly rather than hanging", async () => {
    const out = await collect(raceToFirstToken(streamOf([], 1), streamOf([], 5)));
    expect(out).toEqual([]);
  });

  it("🔑 onFirstToken fires exactly once, and only on real content", async () => {
    let n = 0;
    await collect(raceToFirstToken(
      streamOf(["", "A1", "A2"], 1, 2),
      streamOf(["B1"], 500),
      () => { n += 1; },
    ));
    expect(n).toBe(1);
  });

  it("⚠️ the loser closes EVENTUALLY — `.return()` cannot interrupt an await", async () => {
    // 🔑 Written after this test failed at 30ms and taught me the real
    // semantics: calling `.return()` on a generator suspended at `await` does
    // NOT abort it. The close lands only once that await settles. So a hedge
    // genuinely can leave one request in flight for a while — bounded by each
    // engine's own abortMs, but not instant. Asserting "closed immediately"
    // would have been a comforting test of something untrue.
    let loserClosed = false;
    async function* loser(): AsyncGenerator<string, void, unknown> {
      try { await wait(60); yield "B1"; } finally { loserClosed = true; }
    }
    const out = await collect(raceToFirstToken(streamOf(["A1"], 1), loser()));
    expect(out).toEqual(["A1"]);      // the winner is unaffected by the delay
    expect(loserClosed).toBe(false);  // still in flight the moment we finish
    await wait(140);
    expect(loserClosed).toBe(true);   // …and it does unwind, it is not a leak
  });
});
