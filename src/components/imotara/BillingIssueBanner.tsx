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

import { graceBanner, graceLang } from "@/lib/imotara/graceNoticeText";

const MANAGE_URL: Record<"apple" | "google_play", string> = {
  apple: "https://apps.apple.com/account/subscriptions",
  google_play: "https://play.google.com/store/account/subscriptions?package=com.imotara.imotara",
};

/** The banner sentence in the person's language (#85) — English is the owner-approved text of 6 Nov. */
export function billingBannerText(store: "apple" | "google_play", until: string, lang?: string | null): string {
  return graceBanner(store, until, lang).text;
}

export default function BillingIssueBanner({ lang }: { lang?: string | null } = {}) {
  const snap = useSyncExternalStore(subscribeLicenseStore, getLicenseSnapshot, getLicenseServerSnapshot);
  const issue = snap.data?.billingIssue;
  if (!issue || issue.kind !== "grace" || Date.parse(issue.until) <= Date.now()) return null;
  const g = graceBanner(issue.store, issue.until, lang);
  const rtl = ["ar", "ur", "he"].includes(graceLang(lang));
  return (
    <div role="status" dir={rtl ? "rtl" : undefined} className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <span className="flex-1 min-w-[12rem]">{g.text}</span>
      <a
        href={MANAGE_URL[issue.store]}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg border border-amber-400/30 px-2.5 py-1 font-medium text-amber-100 hover:bg-amber-400/10"
      >
        {g.button}
      </a>
    </div>
  );
}
