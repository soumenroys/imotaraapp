/**
 * "We could not analyse this" must not look like "you had an unremarkable week".
 *
 * 🔴 U11 of the 2026-10-09 audit, VERIFIED 2026-10-10 — and there were THREE
 * silent-success paths, not the one reported:
 *
 *   1. `if (!result.text) return { analysis:"", advice:"" }`      ← HTTP 200
 *   2. the regex rescue coming up empty after a JSON parse failure
 *   3. BOTH clients calling r.json() unconditionally, so even the existing
 *      500 was read for an `analysis` it does not have and `?? ""` made it
 *      an empty success
 *
 * ⚠️ And the call had no budget of its own, so it inherited planBudget's chat
 * default — 8s, the number chosen for a SHORT CONVERSATIONAL REPLY — for 600
 * tokens of analysis over 60 messages. So it aborted often, and every abort
 * came back as a blank, cheerful 200.
 *
 * 🔑 Four independent things had to be right for a user to ever see this
 * feature work, and none of the four said anything when it did not. That is
 * the same shape as U5: a failure that renders as a plausible empty state is
 * invisible to everyone, including us.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const ROUTE = "src/app/api/mindset-analysis/route.ts";
const WEB = "src/app/history/page.tsx";
const AI = "src/lib/imotara/aiClient.ts";

describe("🔴 the analysis gets a budget suited to the analysis", () => {
  const s = raw(ROUTE);

  it("it no longer inherits the chat default", () => {
    expect(s).toMatch(/abortMs: 10_000,/);
  });

  it("🔑 abortMs really does override the plan — or the number is decoration", () => {
    expect(raw(AI)).toMatch(/const abortMs = options\.abortMs \?\? plan\.primaryMs;/);
  });

  it("⚠️ …and the fallback still has its floor, so 10s cannot starve it", () => {
    // This is why 10s is safe rather than reckless: remainingBudgetMs clamps
    // UP to FALLBACK_RESERVE_MS however long the primary took.
    expect(raw(AI)).toMatch(/return Math\.max\(FALLBACK_RESERVE_MS, TOTAL_REPLY_BUDGET_MS - elapsedMs\);/);
  });
});

describe("🔴 a failure is reported as a failure", () => {
  const s = raw(ROUTE);

  it("no text from the AI is a 502, not a cheerful 200", () => {
    expect(s).toMatch(/error: "analysis_unavailable"[\s\S]{0,80}?status: 502/);
  });

  it("…and it says WHY, with the numbers to act on", () => {
    const i = s.indexOf("if (!result.text) {");
    const block = s.slice(i, i + 900);
    expect(block).toMatch(/console\.warn/);
    expect(block).toMatch(/from=\$\{result\.meta\?\.from\}/);
    expect(block).toMatch(/messages=\$\{sample\.length\}/);
  });

  it("the unrecoverable-parse path also speaks up", () => {
    expect(s).toMatch(/if \(!aMatch && !vMatch\) \{/);
    expect(s).toMatch(/neither JSON nor/);
  });

  it("⛔ but a genuinely EMPTY period is still a quiet, legitimate 200", () => {
    // Someone with no messages really does have nothing to analyse. Turning
    // that into an error would be the opposite mistake.
    expect(s).toMatch(/if \(messages\.length === 0\) \{\s*return NextResponse\.json\(\{ analysis: "", advice: "" \}\);/);
  });
});

describe("🔴 both clients stop rendering an error as an empty result", () => {
  it("web checks r.ok before parsing", () => {
    const s = raw(WEB);
    const i = s.indexOf('fetch("/api/mindset-analysis"');
    const block = s.slice(i, i + 1200);
    expect(block).toMatch(/if \(!r\.ok\) throw new Error\(`mindset-analysis HTTP \$\{r\.status\}`\);/);
    expect(block).not.toMatch(/\.then\(\(r\) => r\.json\(\)\)/);
  });

  it("…and its error state is still reachable", () => {
    const s = raw(WEB);
    const i = s.indexOf('fetch("/api/mindset-analysis"');
    expect(s.slice(i, i + 1600)).toMatch(/\.catch\(\(\) => setCapsuleInsights\(\(v\) => \(\{ \.\.\.v, \[key\]: "error" \}\)\)\)/);
  });

  it("🔑 mobile was fixed the same way — the defect was identical", () => {
    const m = "/Users/soumenroy/Projects/imotara-mobile/src/screens/HistoryScreen.tsx";
    if (!fs.existsSync(m)) {
      console.warn("[anOutageIsNotAnEmptyAnalysis] ⚠️ SKIPPED the mobile half — sibling repo not checked out.");
      return;
    }
    expect(fs.readFileSync(m, "utf8")).toMatch(/if \(!r\.ok\) throw new Error\(`mindset-analysis HTTP \$\{r\.status\}`\);/);
  });
});
