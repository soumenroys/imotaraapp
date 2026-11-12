// src/__tests__/billing/plusListIsHonest.test.ts
// 🔑 #132 F (12 Nov 2026 audit, verified in code): the upgrade page sold as Plus four things every
// free user already has or that were never built, and two organisation features that do not exist:
//   · cross-device sync  — free tier has CLOUD_SYNC (lib/imotara/featureGates.ts)
//   · tone choice        — no tier check anywhere; owner 17 Sep: tone + quality are tier-blind
//   · personas / response length — never built
//   · data residency     — all data lives in one region (Seoul)
//   · "API access to conversation summaries" — the API returns counts only, never anyone's words
// Mirror of the app's src/__tests__/plusListIsHonest.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { featuresForTier } from "@/lib/imotara/featureGates";

const page = readFileSync("src/app/upgrade/page.tsx", "utf8");
// Only what the visitor reads: string literals, not the explaining comments.
const shown = (page.match(/"[^"\n]*"/g) ?? []).join("\n");

describe("the upgrade page sells only what Plus really adds", () => {
  it.each([
    ["personas — never built", /\bpersonas?\b/i],
    ["response length — never built", /response length/i],
    ["'1 tone' on free — tones are never gated", /"1 tone"|all tones/i],
    ["data residency — one region only", /residency/i],
    ["conversation summaries via API — counts only", /conversation summar/i],
    ["SCIM — not built", /\bSCIM\b/],
  ])("%s", (_why, rx) => {
    expect(shown).not.toMatch(rx);
  });

  it("cross-device sync is marked free, because it is", () => {
    expect(featuresForTier("free").has("CLOUD_SYNC")).toBe(true);
    const row = page.slice(page.indexOf('label: "Cross-device sync"'), page.indexOf('label: "Cross-device sync"') + 250);
    expect(row).toMatch(/free: true/);
  });
});
