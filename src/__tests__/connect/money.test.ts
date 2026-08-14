/**
 * src/__tests__/connect/money.test.ts
 *
 * Regression tests for the Connect 80/20 platform-fee split
 * (P2-16, code_review_audit_2026_08_14). The whole point of
 * splitSessionEarnings is that platformFee + consultantCredited ===
 * amountCharged is true BY CONSTRUCTION — these tests exist to catch any
 * future change that breaks that invariant, especially the exact
 * repeating-decimal rate that originally exposed the float-drift bug
 * (P1-4).
 */

import { describe, it, expect } from "vitest";
import { splitSessionEarnings, PLATFORM_FEE_RATE } from "@/lib/connect/money";

describe("splitSessionEarnings", () => {
  it("reconciles exactly: platformFee + consultantCredited === amountCharged", () => {
    const cases: [number, number][] = [
      [3, 36.663],   // the exact P1-4 audit repro (109.98899999999999 raw)
      [1, 5],
      [0, 10],       // zero minutes
      [7, 12.345],
      [60, 0.01],    // smallest legal rate (rate_per_min CHECK > 0)
      [1000, 999.9999],
    ];
    for (const [minutes, rate] of cases) {
      const split = splitSessionEarnings(minutes, rate);
      expect(split.platformFee + split.consultantCredited).toBeCloseTo(split.amountCharged, 10);
    }
  });

  it("matches the exact P1-4 audit numbers", () => {
    const split = splitSessionEarnings(3, 36.663);
    expect(split.amountCharged).toBe(109.989);
    expect(split.platformFee).toBe(21.9978);
    expect(split.consultantCredited).toBe(87.9912);
  });

  it("platformFee is ~20% (within rounding) of amountCharged", () => {
    const split = splitSessionEarnings(10, 50);
    expect(split.amountCharged).toBe(500);
    expect(split.platformFee).toBeCloseTo(500 * PLATFORM_FEE_RATE, 10);
  });

  it("zero minutes produces zero everywhere, no NaN/negative", () => {
    const split = splitSessionEarnings(0, 36.663);
    expect(split).toEqual({ amountCharged: 0, platformFee: 0, consultantCredited: 0 });
  });

  it("consultantCredited is never negative for any positive input", () => {
    for (const rate of [0.01, 1, 36.663, 999.9999]) {
      for (const minutes of [0, 1, 5, 60, 500]) {
        const split = splitSessionEarnings(minutes, rate);
        expect(split.consultantCredited).toBeGreaterThanOrEqual(0);
        expect(split.platformFee).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("output never carries more than 4 decimal places (matches NUMERIC(12,4) columns)", () => {
    const split = splitSessionEarnings(7, 12.345);
    for (const v of [split.amountCharged, split.platformFee, split.consultantCredited]) {
      const decimals = (String(v).split(".")[1] ?? "").length;
      expect(decimals).toBeLessThanOrEqual(4);
    }
  });
});
