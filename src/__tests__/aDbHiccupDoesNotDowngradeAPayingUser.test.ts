/**
 * A database hiccup must not take away what somebody paid for.
 *
 * 🔴 U10 of the 2026-10-09 audit, VERIFIED 2026-10-10 by reading both cited
 * lines rather than trusting the report. Both halves were exactly as claimed.
 *
 *   serverGate.ts
 *     const tier = normaliseTier(tierResult.ok ? …effectiveTier : "free");
 *
 * When `resolveUserTier()` ERRORS, the tier became "free" — indistinguishable
 * from a genuinely free user. Under LICENSE_MODE=enforce one transient DB
 * error therefore 403'd a PAYING subscriber out of features they bought.
 *
 * 🔑 THE PART THAT MAKES IT WORSE. `api/license/status/route.ts` already
 * documents this precise failure, at length, and refuses to do it — it returns
 * `tier_unresolved` instead. But that route only REPORTS the tier. This is the
 * code that ENFORCES it. The two disagreed, and the worse half was the one
 * with teeth: the person's UI kept saying "Plus" while the server quietly
 * refused them, with no error anywhere to connect the two.
 *
 * ⚖️ THE TRADE, STATED PLAINLY. On an unresolved lookup we now fail OPEN: a
 * free user might reach a paid feature during an outage. That is bounded and
 * rare. The alternative is confiscating a paid feature because our database
 * blinked, and that is not a trade worth making.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const code = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const GATE = "src/lib/imotara/serverGate.ts";
const STATUS = "src/app/api/license/status/route.ts";

describe("🔴 'could not look it up' is not the same as 'free'", () => {
  it("resolveRequestTier reports whether it actually found out", () => {
    const s = code(GATE);
    expect(s).toMatch(/tierResolved: boolean;/);
    expect(s).toMatch(/return \{ userId, tier, tierResolved: tierResult\.ok \};/);
  });

  it("⚠️ an ANONYMOUS caller is resolved, not unresolved", () => {
    // Anonymous genuinely IS free. Marking it unresolved would fail open for
    // every signed-out visitor — the opposite mistake, and a far bigger hole.
    expect(code(GATE)).toMatch(/return \{ userId: null, tier: "free", tierResolved: true \};/);
  });

  it("🔑 requireFeature refuses to enforce on an unresolved tier", () => {
    const s = code(GATE);
    expect(s).toMatch(/if \(!tierResolved\) \{/);
    const i = s.indexOf("if (!tierResolved) {");
    const block = s.slice(i, i + 420);
    expect(block).toMatch(/return \{ ok: true, tier, userId \};/);  // fails OPEN
    expect(block).toMatch(/console\.warn/);                          // and says so
  });

  it("⛔ …but a RESOLVED free tier is still enforced", () => {
    // The fix must not become "never enforce anything".
    const s = code(GATE);
    const i = s.indexOf("if (!tierResolved) {");
    expect(s.slice(i)).toMatch(/const result = gate\(feature, tier\);/);
    expect(s).toMatch(/if \(!result\.enabled\)/);
  });

  it("the two halves of the product now agree", () => {
    // license/status refuses to report `free` on a failed lookup; the gate now
    // refuses to enforce on one. Before this they disagreed.
    const st = fs.readFileSync(path.join(process.cwd(), STATUS), "utf8");
    expect(st).toMatch(/error: "tier_unresolved"/);
    expect(code(GATE)).toMatch(/if \(!tierResolved\)/);
  });

  it("⚠️ normaliseTier is still used — a legacy `pro` must not gate nothing", () => {
    expect(code(GATE)).toMatch(/const tier = normaliseTier\(/);
  });
});
