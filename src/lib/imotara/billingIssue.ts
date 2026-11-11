// src/lib/imotara/billingIssue.ts
// Telling a subscriber their payment failed, while there is still time to fix it.
//
// 🔑 OWNER, 6 Nov 2026: Apple's billing grace period was switched ON (16 days,
// paid-to-paid) — "can we add one alert to user until they are in grace
// period?" ⇒ a banner (web now, the apps from 1.6.3) AND one email, so someone
// who rarely opens the app still hears before Plus stops.
//
// How it flows:
//   daily /api/cron/store-renewals asks Apple and Google ⇒ recordBillingState()
//   writes "grace until <date>" on the licence, or clears it once the store has
//   been paid ⇒ /api/license/status returns it as `billingIssue` ⇒ banner;
//   notifyGraceOnce() sends the single email and stamps it, so it never repeats.
//
// ⛔ Nothing here grants or removes Plus. Grace is still Plus (the grant uses
// the store's own expiry); this only TELLS the person.
// ⚠️ The four columns come from docs/sql/licenses_billing_issue.sql. Until it is
// run, every write here fails soft and logs — the renewal sweep is unaffected.

import type { SupabaseClient } from "@supabase/supabase-js";
import { graceBanner, graceEmailLines, graceLang } from "@/lib/imotara/graceNoticeText";

export type BillingStore = "apple" | "google_play";
export type BillingIssue = { kind: "grace"; until: string; store: BillingStore };

/** Where the person fixes it — the store's own subscription page, never ours. */
export const MANAGE_URL: Record<BillingStore, string> = {
  apple: "https://apps.apple.com/account/subscriptions",
  google_play: "https://play.google.com/store/account/subscriptions?package=com.imotara.imotara",
};

const STORE_NAME: Record<BillingStore, string> = { apple: "App Store", google_play: "Google Play" };

/** The licence row ⇒ the issue to show, or null. A grace date already past is no longer an issue. */
export function billingIssueFromRow(
  row: { billing_issue?: string | null; billing_issue_until?: string | null; billing_issue_store?: string | null } | null | undefined,
  now = Date.now(),
): BillingIssue | null {
  if (!row || row.billing_issue !== "grace" || !row.billing_issue_until) return null;
  if (row.billing_issue_store !== "apple" && row.billing_issue_store !== "google_play") return null;
  if (Date.parse(row.billing_issue_until) <= now) return null;
  return { kind: "grace", until: row.billing_issue_until, store: row.billing_issue_store };
}

/**
 * What the store said today ⇒ the licence. `graceUntil` null ⇒ paid (or lapsed):
 * clear it — but only a flag THIS store set, never the other store's.
 */
export async function recordBillingState(
  admin: SupabaseClient,
  userId: string,
  store: BillingStore,
  graceUntil: string | null,
): Promise<void> {
  // ⛔ NEVER THROWS: this runs inside the renewal sweep, and a notice must not cost anyone their renewal.
  try {
    const q = graceUntil
      ? admin.from("licenses").update({ billing_issue: "grace", billing_issue_until: graceUntil, billing_issue_store: store }).eq("user_id", userId)
      : admin.from("licenses").update({ billing_issue: null, billing_issue_until: null, billing_issue_store: null, billing_issue_notified_at: null })
          .eq("user_id", userId).eq("billing_issue_store", store);
    const { error } = await q;
    if (error) console.error("[billingIssue] record failed:", error.message);
  } catch (e) {
    console.error("[billingIssue] record failed:", e);
  }
}

/** "22 November" — the person's own date, said plainly. */
export function humanDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
}

/**
 * The one email, in the person's language (#85, 11 Nov 2026) ⇒ graceNoticeText.ts.
 * ⚠️ Written like a person (house style): no images, no button, one link, no
 * "AI". English is the owner-approved text of 6 Nov, word for word.
 */
export function graceEmail(issue: BillingIssue, lang?: string | null): { subject: string; text: string; html: string } {
  const url = MANAGE_URL[issue.store];
  const where = STORE_NAME[issue.store];
  const { subject, lines } = graceEmailLines(issue.store, issue.until, url, lang);
  const linkText = graceLang(lang) === "en" ? `Open my ${where} subscriptions` : graceBanner(issue.store, issue.until, lang).button;
  const text = lines.join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rtl = ["ar", "ur", "he"].includes(graceLang(lang));
  const html = lines
    .map((l) => (l === url ? `<a href="${url}">${esc(linkText)}</a>` : esc(l)))
    .join("<br>");
  return { subject, text, html: `<div${rtl ? ' dir="rtl"' : ""} style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${html}</div>` };
}

export type NotifyDeps = {
  emailOf: (userId: string) => Promise<string | null>;
  /** The person's chosen language (user_memory preferred_lang); missing ⇒ English. */
  langOf?: (userId: string) => Promise<string | null>;
  send: (m: { to: string; subject: string; text: string; html: string }) => Promise<boolean>;
  now?: number;
};

/** Everyone newly in grace gets ONE email; it is stamped only when it actually went. */
export async function notifyGraceOnce(admin: SupabaseClient, deps: NotifyDeps) {
  const { data, error } = await admin
    .from("licenses")
    .select("user_id, billing_issue, billing_issue_until, billing_issue_store, billing_issue_notified_at")
    .eq("billing_issue", "grace")
    .is("billing_issue_notified_at", null);
  if (error) return { sent: 0, errors: [error.message] };

  let sent = 0;
  const errors: string[] = [];
  for (const row of data ?? []) {
    const issue = billingIssueFromRow(row, deps.now);
    if (!issue) continue;
    const to = await deps.emailOf(row.user_id as string);
    if (!to) continue; // a guest or a deleted address: the banner still tells them
    const lang = deps.langOf ? await deps.langOf(row.user_id as string).catch(() => null) : null;
    const ok = await deps.send({ to, ...graceEmail(issue, lang) });
    if (!ok) { errors.push(`send failed for ${row.user_id}`); continue; }
    const { error: stampErr } = await admin
      .from("licenses")
      .update({ billing_issue_notified_at: new Date(deps.now ?? Date.now()).toISOString() })
      .eq("user_id", row.user_id as string);
    if (stampErr) errors.push(stampErr.message);
    else sent++;
  }
  return { sent, errors };
}
