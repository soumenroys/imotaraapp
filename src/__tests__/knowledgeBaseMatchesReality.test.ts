/**
 * The Knowledge Base must describe the product that exists.
 *
 * 🔴 WHY THIS EXISTS. On 2026-10-06 a sweep fixed the retired tier and the
 * retired prices across `docs/*.html` and the ten sales PDFs, and
 * marketingDocsNoRetiredTier.test.ts was written to stop them coming back.
 * That test reads **`docs/`**. Nobody noticed that `ImotaraKnowledgebase/`
 * — seventeen documents, the internal source of truth that staff and sales
 * read — was never in scope. So the day after "every document" was declared
 * clean, the KB was still:
 *
 *   - quoting plus_annual at ₹699 and plus_monthly at ₹99, the pair retired
 *     on 2026-09-25. The real figures are ₹1,299 and ₹149 — the KB understated
 *     the annual plan by 46%.
 *   - selling a **Pro tier** that does not exist. TIER_ORDER is
 *     ["free","plus","family","edu","enterprise"]; there is no `pro` in the
 *     type system at all. End-User-Step-by-Step-Guide offered "Plus (₹99/mo)
 *     or Pro (₹149/mo)" — two wrong prices, inverted against each other,
 *     for one real plan and one imaginary one.
 *   - telling readers `SOFT_LAUNCH_BYPASS_ALL_GATES` is "currently `true`".
 *     🔴 It is `false`. Enforcement went live on 2026-10-01. A technical guide
 *     that says the gates are off is the kind of thing that gets enforcement
 *     "fixed" back off by someone who trusted it.
 *   - capping Plus history at 90 days. HISTORY_RETENTION_DAYS gives plus
 *     `Infinity`.
 *
 * ⚠️ WHAT THIS TEST DELIBERATELY DOES NOT DO. It does not ban the word "Pro".
 * `pro_monthly` and `pro_annual` are REAL product ids — legacy Play/Apple SKUs
 * kept for the grandfathered subscriber, both mapping to `tier: "plus"` at the
 * current price. Store ids are permanent and cannot be renamed. The claims are
 * what is wrong, not the string.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TIER_ORDER } from "@/types/license";
import { PRODUCT_CATALOG } from "@/lib/imotara/pricing";
import { HISTORY_RETENTION_DAYS } from "@/lib/imotara/serverGate";

const KB = path.join(process.cwd(), "ImotaraKnowledgebase");
const docs = fs.readdirSync(KB).filter((f) => f.endsWith(".md"));
const read = (f: string) => fs.readFileSync(path.join(KB, f), "utf8");

describe("the KB folder is actually being checked", () => {
  it("finds the documents", () => {
    // If this ever goes to zero the whole file passes vacuously — exactly the
    // failure mode that let ten sales PDFs sit unguarded (`ebf826c`).
    expect(docs.length).toBeGreaterThan(10);
  });
});

describe("🔴 no document quotes a retired subscription price", () => {
  /**
   * Derived from the catalog, so a future price change moves this test with
   * the product instead of against it.
   */
  const live = {
    monthly: PRODUCT_CATALOG.plus_monthly.paise / 100,
    annual:  PRODUCT_CATALOG.plus_annual.paise / 100,
  };

  it("the live prices are what we think they are", () => {
    expect(live.monthly).toBe(149);
    expect(live.annual).toBe(1299);
  });

  it.each(docs)("%s does not sell the plan at the retired ₹99/₹699", (f) => {
    const s = read(f);
    // ⚠️ TWO ways to get this wrong, and I hit both while writing it.
    //  1. ₹99 is ALSO the real price of the 250-token pack, so a bare "₹99"
    //     must not fail — only ₹99 attached to a SUBSCRIPTION.
    //  2. A bare "₹699" ban also fails the sentence that TELLS support staff
    //     ₹699 is retired, which is exactly the knowledge worth keeping. The
    //     claim is what is banned, not the number.
    expect(s).not.toMatch(/₹99\s*\/\s*mo/i);
    expect(s).not.toMatch(/₹699\s*\/\s*(yr|year|annum|annual)/i);
    expect(s).not.toMatch(/\bplus_monthly\b[^\n]*₹99\b/);
    expect(s).not.toMatch(/\bplus_annual\b[^\n]*₹699\b/);
    // the paise figure has no innocent reading — 69,900 is only ever the old price
    expect(s).not.toMatch(/\b69,900\b/);
  });

  it("and the retirement is still written down somewhere, so support knows", () => {
    // Banning the number outright would have deleted this. Losing it means the
    // next person who finds ₹699 on a slide has no way to know it is stale.
    const all = docs.map(read).join("\n");
    expect(all).toMatch(/₹99\/₹699[^\n]*retired/i);
  });
});

describe("🔴 no document sells a Pro TIER — the type system has none", () => {
  it("TIER_ORDER really has no pro", () => {
    expect([...TIER_ORDER]).not.toContain("pro");
    expect([...TIER_ORDER]).toEqual(["free", "plus", "family", "edu", "enterprise"]);
  });

  it("…and the legacy pro_* product ids map to plus, which is why they may stay", () => {
    // Store ids are permanent; these exist for the grandfathered subscriber.
    expect(PRODUCT_CATALOG.pro_monthly.tier).toBe("plus");
    expect(PRODUCT_CATALOG.pro_annual.tier).toBe("plus");
  });

  it.each(docs)("%s does not offer Pro as a plan a user can pick", (f) => {
    const s = read(f);
    expect(s).not.toMatch(/\bor\s+\*\*Pro\*\*/i);
    expect(s).not.toMatch(/Pick a plan[^\n]*\bPro\b/i);
  });

  it.each(docs)("%s does not state a tier rank containing pro", (f) => {
    // "free < plus < pro < family < edu < enterprise" was in the org guide.
    expect(read(f)).not.toMatch(/plus\s*<\s*pro\b/i);
  });
});

describe("🔴 no document claims the premium bypass is on", () => {
  it("the flag really is false", () => {
    // ⚠️ CROSS-REPO. This resolves into ../imotara-mobile, which exists on a
    // developer's machine and NOT on the CI runner — the same mistake `b6434ca`
    // fixed in breathingSounds.test.ts, which I then repeated here within the
    // hour. Loud skip, same idiom: the KB assertions below still run in CI.
    const gates = path.join(process.cwd(), "..", "imotara-mobile", "src", "licensing", "featureGates.ts");
    if (!fs.existsSync(gates)) {
      console.warn(
        `[knowledgeBaseMatchesReality] ⚠️ SKIPPED the bypass-flag check: ${gates} not found. ` +
        "This half only has teeth when both repos are checked out side by side.",
      );
      return;
    }
    expect(fs.readFileSync(gates, "utf8")).toMatch(/SOFT_LAUNCH_BYPASS_ALL_GATES\s*=\s*false/);
  });

  it.each(docs)("%s does not say the bypass is currently true", (f) => {
    const s = read(f);
    expect(s).not.toMatch(/SOFT_LAUNCH_BYPASS_ALL_GATES[^\n]*currently\s*`?true/i);
  });
});

describe("🔴 no document caps Plus history", () => {
  it("plus retention really is unlimited", () => {
    expect(HISTORY_RETENTION_DAYS.plus).toBe(Infinity);
    expect(HISTORY_RETENTION_DAYS.free).toBe(7);
  });

  it.each(docs)("%s does not give Plus a 90-day history cap", (f) => {
    expect(read(f)).not.toMatch(/Plus\s+90\s*days/i);
  });
});
