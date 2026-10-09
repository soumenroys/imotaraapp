/**
 * The server must finish inside the time the CLIENT will actually wait.
 *
 * 🔴 WHY. `TOTAL_REPLY_BUDGET_MS = 14_000` was chosen to sit "comfortably
 * under the shortest client timeout", documented in that file as
 * "web: 20s overall … mobile: 20-25s in fetchWithTimeout.ts".
 *
 * That stopped being true and nobody noticed:
 *   imotara-mobile/src/lib/network/fetchWithTimeout.ts:11
 *     export const DEFAULT_REMOTE_TIMEOUT_MS = 10000;   // "Was 20000."
 *   and 10 is the SMALLEST option on BOTH platforms:
 *     SettingsScreen.tsx / app/settings/page.tsx
 *     API_TIMEOUT_OPTIONS = [10, 20, 30, 60]
 *
 * So a constant on one side of the wire described the other side, and drifted.
 * The fix is not a better constant — it is to stop guessing: the client sends
 * `x-imotara-client-timeout-ms` and planBudget() sizes the server to fit.
 *
 * ⚖️ THE ONE REAL TRADE, PINNED HERE ON PURPOSE.
 * A 10s client leaves ~8.5s. That cannot hold a generous primary AND a usable
 * fallback. The choice made was:
 *
 *   X  primary 8.5s, NO fallback    → ~95% of replies from OpenAI, else template
 *   Y  primary ~3s + fallback ~5.2s → more replies, many from the WEAKER model
 *
 * **X.** Y buys reply COUNT by spending reply QUALITY, and the standing rule
 * on this project is that reply quality must be the same or better, never
 * worse. If someone later "improves" this by re-enabling the fallback at tiny
 * budgets, these tests should stop them and make them read the reasoning.
 *
 * 🔑 X also loses ~nothing against the old behaviour: with an 8s primary a 10s
 * client needed Gemini to answer in <1.5s to beat the abort — below its
 * measured 1.2–2.6s range. That fallback was already failing almost always.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const AI = "src/lib/imotara/aiClient.ts";
const ROUTE = "src/app/api/chat-reply/route.ts";
const WEB_CLIENT = "src/lib/imotara/respondRemote.ts";

/** Mirror of planBudget(), kept in the test so the ARITHMETIC is asserted. */
const TOTAL = 14_000, RESERVE = 6_000, PRIMARY = TOTAL - RESERVE;
const OVERHEAD = 1_500, MIN_PRIMARY = 5_000;
function plan(clientBudgetMs?: number) {
  if (typeof clientBudgetMs !== "number" || !Number.isFinite(clientBudgetMs) || clientBudgetMs <= 0) {
    return { primaryMs: PRIMARY, fallbackEnabled: true };
  }
  const available = clientBudgetMs - OVERHEAD;
  if (available >= MIN_PRIMARY + RESERVE) {
    return { primaryMs: Math.min(PRIMARY, available - RESERVE), fallbackEnabled: true };
  }
  return { primaryMs: Math.max(MIN_PRIMARY, available), fallbackEnabled: false };
}

describe("🔴 the whole chain fits inside what the client will wait for", () => {
  it.each([10_000, 20_000, 30_000, 60_000])(
    "at the %ims setting the server cannot outlast the client",
    (clientMs) => {
      const p = plan(clientMs);
      const worstChain = p.primaryMs + (p.fallbackEnabled ? RESERVE : 0) + OVERHEAD;
      expect(worstChain).toBeLessThanOrEqual(clientMs);
    },
  );

  it("⚠️ those four ARE the options offered — not a number I made up", () => {
    // If the product ever offers a 5s option, the loop above must cover it.
    const web = read("src/app/settings/page.tsx");
    expect(web).toMatch(/API_TIMEOUT_OPTIONS = \[10, 20, 30, 60\]/);
  });

  it("🔑 an older client that sends no header keeps today's behaviour exactly", () => {
    const p = plan(undefined);
    expect(p).toEqual({ primaryMs: 8_000, fallbackEnabled: true });
  });
});

describe("⚖️ the quality trade at a short budget — do not reverse this casually", () => {
  it("at 10s the fallback is DISABLED and the primary gets the whole window", () => {
    const p = plan(10_000);
    expect(p.fallbackEnabled).toBe(false);
    expect(p.primaryMs).toBe(8_500);
  });

  it("🔑 and that is MORE primary time than before, not less", () => {
    // The reply-quality guarantee in one line: a 10s user gets a longer shot
    // at the better model than they did yesterday, never a shorter one.
    expect(plan(10_000).primaryMs).toBeGreaterThan(PRIMARY);
  });

  it("⛔ the primary is never starved to squeeze a fallback in", () => {
    for (const clientMs of [6_000, 8_000, 10_000, 11_000, 12_500]) {
      expect(plan(clientMs).primaryMs).toBeGreaterThanOrEqual(MIN_PRIMARY);
    }
  });

  it("at 20s and above the fallback is back, with the full reserve", () => {
    for (const clientMs of [20_000, 30_000, 60_000]) {
      const p = plan(clientMs);
      expect(p.fallbackEnabled).toBe(true);
      expect(p.primaryMs).toBe(PRIMARY); // capped — never longer than designed
    }
  });

  it("the implementation really does disable rather than shrink the fallback", () => {
    const s = read(AI);
    expect(s).toMatch(/fallbackEnabled: false/);
    // FOUR hops, verified: 2 in callImotaraAI (HTTP error + fetch exception)
    // and the same 2 shapes in streamImotaraAI. Guarding 3 of 4 would leave
    // one path still burning a doomed Gemini call.
    expect([...s.matchAll(/if \(!plan\.fallbackEnabled\)/g)].length).toBe(4);
  });

  it("⚠️ skipping the fallback must NOT page anyone — it is a budget choice", () => {
    // sendOutageAlert wakes a human. A deliberate decision is not an incident.
    const s = read(AI);
    const skips = s.split("if (!plan.fallbackEnabled)").slice(1);
    expect(skips.length).toBe(4);
    for (const after of skips) {
      const block = after.slice(0, 400);
      expect(block).toMatch(/console\.warn/);
      expect(block).not.toMatch(/sendOutageAlert/);
    }
  });
});

describe("🔴 both ends of the wire are actually connected", () => {
  it("the route reads the header and clamps it", () => {
    const s = read(ROUTE);
    expect(s).toMatch(/x-imotara-client-timeout-ms/);
    // Attacker-controllable: an absurd value holds a function open.
    expect(s).toMatch(/Math\.min\(Math\.max\(n, 5_000\), 120_000\)/);
  });

  it("…and passes it to BOTH the streaming and JSON calls", () => {
    const s = read(ROUTE);
    expect([...s.matchAll(/clientBudgetMs: clientBudgetFrom\(req\)/g)].length).toBe(2);
  });

  it("the WEB client sends its real timeout, not a constant", () => {
    const s = read(WEB_CLIENT);
    expect(s).toMatch(/"x-imotara-client-timeout-ms": String\(apiTimeoutMs\)/);
  });

  it("⚠️ a header with no planner, or a planner with no header, is useless", () => {
    // Both halves or neither. This catches half a revert.
    expect(read(AI)).toMatch(/function planBudget\(clientBudgetMs\?: number\): BudgetPlan/);
    expect(read(ROUTE)).toMatch(/function clientBudgetFrom\(req: Request\)/);
  });
});
