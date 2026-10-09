/**
 * The Gemini fallback must always be left a usable slice of the reply budget.
 *
 * 🔴 WHY THIS EXISTS — a real TOTAL OUTAGE, production `cb0ee7c`,
 * 2026-10-08T18:47Z. Two alerts 20s apart:
 *
 *   [imotara][alert] OpenAI unavailable — Gemini fallback active.
 *                    Reason: This operation was aborted
 *   [imotara][alert] TOTAL OUTAGE — no working AI engine (OpenAI and Gemini
 *                    both failed). Users are getting template replies.
 *                    Reason: Gemini failed on model "gemini-3.5-flash":
 *                    This operation was aborted
 *
 * ⚠️ NOT a billing failure, though that is the obvious guess and the alert
 * email itself suggests checking credits first. Gemini held ₹2,933.66 at the
 * time, topped up four hours earlier. A credit failure reads
 * `429 insufficient_quota` — that was August's outage
 * (see openai_credit_outage), not this one. "This operation was aborted" is
 * the AbortController firing: a TIMEOUT.
 *
 * 🔑 THE STRUCTURAL BUG. Both OpenAI entry points defaulted their abort to the
 * FULL budget:
 *
 *     const abortMs = options.abortMs ?? TOTAL_REPLY_BUDGET_MS;   // 14_000
 *
 * So when OpenAI failed *by timing out*, it had by definition consumed all
 * 14s — and the fallback was then handed
 * `remainingBudgetMs(14_000)`, which collapses to the floor. The floor was
 * 3s, against a measured gemini-3.5-flash range of 1.2–2.6s. About 0.4s of
 * margin.
 *
 * ⇒ **The fallback was least likely to work in exactly the case it exists
 * for.** A slow-but-alive OpenAI is the single most likely way the primary
 * fails, and that is the one failure mode that starved the fallback.
 *
 * ⛔ This is why the test asserts a RESERVE, not a floor. A floor can be
 * reached by exhaustion; a reserve cannot be spent by the primary at all.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const AI = "src/lib/imotara/aiClient.ts";

describe("🔴 the primary cannot consume the whole reply budget", () => {
  it("both OpenAI entry points abort at PRIMARY_BUDGET_MS, not the total", () => {
    const s = read(AI);
    // ⚠️ Counted, not matched once. There are FOUR `options.abortMs ??` sites:
    // two OpenAI (callImotaraAI, streamImotaraAI) and two Gemini defaults that
    // only matter for a hypothetical standalone call. Fixing one and missing
    // the other would leave the streaming path — the one the WEB uses — broken,
    // and a single toMatch would not have noticed.
    const primary = [...s.matchAll(/options\.abortMs \?\? PRIMARY_BUDGET_MS/g)];
    expect(primary.length).toBe(2);
  });

  it("the two Gemini defaults are deliberately left at the full ceiling", () => {
    const s = read(AI);
    const fallbackDefaults = [...s.matchAll(/options\.abortMs \?\? TOTAL_REPLY_BUDGET_MS/g)];
    expect(fallbackDefaults.length).toBe(2);
  });

  it("the primary budget is strictly less than the total", () => {
    const s = read(AI);
    expect(s).toMatch(/PRIMARY_BUDGET_MS = TOTAL_REPLY_BUDGET_MS - FALLBACK_RESERVE_MS/);
  });
});

describe("🔴 the reserve is big enough to be worth having", () => {
  const nums = () => {
    const s = read(AI);
    const grab = (name: string) => {
      const m = s.match(new RegExp(`const ${name} = ([\\d_]+)`));
      return m ? Number(m[1].replace(/_/g, "")) : NaN;
    };
    return { total: grab("TOTAL_REPLY_BUDGET_MS"), reserve: grab("FALLBACK_RESERVE_MS") };
  };

  it("the constants are what we think they are", () => {
    const { total, reserve } = nums();
    expect(total).toBe(14_000);
    expect(reserve).toBe(6_000);
  });

  it("⚠️ the reserve clears gemini-3.5-flash's MEASURED worst case with real margin", () => {
    // Measured 1.2–2.6s (openai_credit_outage, 2026-08-22). The old 3s floor
    // gave 0.4s of headroom over 2.6s — which is what failed on 10-08.
    // Anything under ~2x the worst case is not a reserve, it is a coin toss.
    const { reserve } = nums();
    const GEMINI_MEASURED_WORST_MS = 2_600;
    expect(reserve).toBeGreaterThanOrEqual(2 * GEMINI_MEASURED_WORST_MS);
  });

  it("…and the total still fits under the shortest client timeout", () => {
    // web: 20s stream-stall in respondRemote.ts; mobile: 20–25s in
    // fetchWithTimeout.ts. Spending the whole budget must still leave the
    // client waiting, not give up — otherwise the compute is paid for and
    // thrown away, which is the problem TOTAL_REPLY_BUDGET_MS exists to stop.
    const { total } = nums();
    const SHORTEST_CLIENT_TIMEOUT_MS = 20_000;
    expect(total).toBeLessThan(SHORTEST_CLIENT_TIMEOUT_MS);
  });

  it("remainingBudgetMs floors on the reserve, so a slow primary cannot starve it", () => {
    const s = read(AI);
    expect(s).toMatch(/Math\.max\(FALLBACK_RESERVE_MS, TOTAL_REPLY_BUDGET_MS - elapsedMs\)/);
  });
});

describe("the alerting that caught this is still wired", () => {
  it("a dead fallback still raises total_outage, not just a degraded notice", () => {
    const s = read(AI);
    expect(s).toMatch(/"total_outage"/);
    expect(s).toMatch(/TOTAL OUTAGE/);
  });
});
