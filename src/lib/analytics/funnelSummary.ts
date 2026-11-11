// src/lib/analytics/funnelSummary.ts — #129 (11 Nov 2026): the anonymous funnel, summed for the admin.
// Pure: rows in, totals + the two rates that matter out. ⇒ funnelIsCountedAnonymously.test.ts
import { FUNNEL_STEPS, type FunnelStep } from "@/lib/analytics/visitTally";

export type FunnelRow = { platform: string; bucket: number; hits: number };
export type FunnelSummary = {
  steps: { step: FunnelStep; web: number; ios: number; android: number; total: number }[];
  rates: { landingCarried: number | null; inviteAccepted: number | null; welcomePicked: number | null; checkoutToPaid: number | null; viewToCheckout: number | null };
};

const BY_NUMBER = Object.fromEntries(Object.entries(FUNNEL_STEPS).map(([k, v]) => [v, k as FunnelStep]));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export function summariseFunnel(rows: FunnelRow[]): FunnelSummary {
  const acc = new Map<FunnelStep, { web: number; ios: number; android: number; total: number }>();
  for (const s of Object.keys(FUNNEL_STEPS) as FunnelStep[]) acc.set(s, { web: 0, ios: 0, android: 0, total: 0 });
  for (const r of rows) {
    const step = BY_NUMBER[r.bucket];
    if (!step) continue;
    const a = acc.get(step)!;
    if (r.platform === "web" || r.platform === "ios" || r.platform === "android") a[r.platform] += r.hits;
    a.total += r.hits;
  }
  const t = (s: FunnelStep) => acc.get(s)!.total;
  return {
    steps: [...acc.entries()].map(([step, v]) => ({ step, ...v })),
    rates: {
      landingCarried: pct(t("landing_sent"), t("landing_send")),
      inviteAccepted: pct(t("invite_accepted"), t("invite_shown")),
      welcomePicked: pct(t("welcome_pick"), t("welcome_shown")),
      viewToCheckout: pct(t("checkout_start"), t("upgrade_view")),
      checkoutToPaid: pct(t("purchase_ok"), t("checkout_start")),
    },
  };
}
