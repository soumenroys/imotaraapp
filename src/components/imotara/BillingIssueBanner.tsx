// src/components/imotara/BillingIssueBanner.tsx
// "Your last payment didn't go through" — shown above the chat box while a
// store subscription is in its billing grace period ⇒ lib/imotara/billingIssue.ts.
//
// 🔑 OWNER, 6 Nov 2026: a banner AND one email. Calm, one line, one action —
// the store's own subscription page, because only the store can fix a card.
// ⛔ No alarm colours, no countdown: this is a person who probably does not
// know yet, not someone who did something wrong.
"use client";

import { useSyncExternalStore } from "react";
import { getLicenseServerSnapshot, getLicenseSnapshot, subscribeLicenseStore } from "@/lib/imotara/licenseStore";

const MANAGE: Record<"apple" | "google_play", { url: string; label: string; store: string }> = {
  apple: { url: "https://apps.apple.com/account/subscriptions", label: "Update payment in the App Store", store: "in the App Store" },
  google_play: { url: "https://play.google.com/store/account/subscriptions?package=com.imotara.imotara", label: "Update payment in Google Play", store: "on Google Play" },
};

export function billingBannerText(store: "apple" | "google_play", until: string): string {
  const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(until));
  return `Your last payment for Imotara Plus didn't go through ${MANAGE[store].store}. Plus stays on until ${when} — update your payment method to keep it.`;
}

export default function BillingIssueBanner() {
  const snap = useSyncExternalStore(subscribeLicenseStore, getLicenseSnapshot, getLicenseServerSnapshot);
  const issue = snap.data?.billingIssue;
  if (!issue || issue.kind !== "grace" || Date.parse(issue.until) <= Date.now()) return null;
  const m = MANAGE[issue.store];
  return (
    <div role="status" className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <span className="flex-1 min-w-[12rem]">{billingBannerText(issue.store, issue.until)}</span>
      <a
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg border border-amber-400/30 px-2.5 py-1 font-medium text-amber-100 hover:bg-amber-400/10"
      >
        {m.label}
      </a>
    </div>
  );
}
