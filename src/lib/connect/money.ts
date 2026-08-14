// src/lib/connect/money.ts
// Single source of truth for the Connect 80/20 platform-fee split. Previously
// this 0.20/0.80 split was reimplemented independently at 9+ call sites
// (tick route x2, connect-orphans cron, consultant/sessions stale-complete,
// completion emails) — two numbers computed from the same inputs but never
// checked against each other, which is exactly how the P1-4 rounding drift
// happened. consultantCredited is derived as the REMAINDER of platformFee,
// not computed independently, so platformFee + consultantCredited ===
// amountCharged is true by construction, not by coincidence.

export const PLATFORM_FEE_RATE = 0.20;

export interface MoneySplit {
  amountCharged: number;
  platformFee: number;
  consultantCredited: number;
}

export function splitSessionEarnings(minutes: number, ratePerMin: number): MoneySplit {
  const amountCharged = +(minutes * ratePerMin).toFixed(4);
  const platformFee = +(amountCharged * PLATFORM_FEE_RATE).toFixed(4);
  // Remainder, not amountCharged * 0.80 — guarantees exact reconciliation.
  const consultantCredited = +(amountCharged - platformFee).toFixed(4);
  return { amountCharged, platformFee, consultantCredited };
}
