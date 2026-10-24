// src/lib/broadcast/autoBroadcast.ts
// The monthly newsletter, written and scheduled by itself — sent only after a
// person approves it.
//
// 🔑 OWNER, 24 Oct 2026: "the broadcasting mail content should be auto
// generated promoting Imotara usage advantages … admin will login everyday and
// take action from his todo page".
//
// How a month goes:
//   1. THREE DAYS BEFORE the send day, the job writes the newsletter (one theme
//      per month, rotated in code) and creates one draft per chosen list.
//   2. The drafts appear on the admin's To do: "approve by <date>".
//   3. ON THE SEND DAY at the chosen hour, every draft that is APPROVED goes
//      out through the normal broadcast sender (warm-up, suppressions,
//      unsubscribe). An unapproved one waits — it is sent within the hour of
//      being approved, never without it.
//
// ⛔ The writer gets the checked FACTS only, and the draft must pass the same
// word check and house style as outreach mail ⇒ outreach/writer.checkDraft.
// ⚠️ app_settings, no migration.

import type { SupabaseClient } from "@supabase/supabase-js";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import { FACTS } from "@/lib/social/writer";
import { renderHtml, renderText } from "@/lib/broadcast/markup";
import { SITE } from "@/lib/broadcast/templates/types";
import { availableIdentities } from "@/lib/broadcast/identities";
import { enqueueBroadcast } from "@/lib/broadcast/enqueue";
import { approvalState, readApprovals } from "@/lib/broadcast/approval";
import { SIGNATURE, checkDraft, parseMail } from "@/lib/outreach/writer";

const KEY = "auto_broadcast";

export type AutoRun = {
  month: string; theme: string; sendAt: string; broadcastIds: string[]; createdAt: string; sent: string[];
  /** What the word and house-style checks found — approval is refused until they are cleared. */
  findings?: string[];
  /** Set while a run is writing it, so a second run cannot write the month again. */
  claimedAt?: string;
};
export type AutoSettings = { enabled: boolean; dayOfMonth: number; hourIst: number; listIds: string[] };
export type AutoState = { settings: AutoSettings; runs: Record<string, AutoRun> };

export const DEFAULT_AUTO: AutoSettings = { enabled: false, dayOfMonth: 5, hourIst: 11, listIds: [] };

/** One theme a month, in this order — rotated in code, never left to the model ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation. */
export const THEMES: { id: string; brief: string }[] = [
  { id: "privacy", brief: "Privacy: conversations stay on your own phone by default; cloud sync is off unless you turn it on." },
  { id: "languages", brief: "Your own language: 22 languages, eleven of them Indian, typed or spoken." },
  { id: "offline", brief: "It works offline, on the device, when there is no signal." },
  { id: "nothing-to-keep-up", brief: "No feed, no streaks, no badges — nothing to keep up with." },
  { id: "remembers", brief: "It remembers what mattered last time, so you need not start again." },
  { id: "honest-limits", brief: "What it is and is not: a private companion, not therapy, and it shows a helpline when needed." },
  { id: "connect", brief: "Imotara Connect: human peer companions — friends, parents, siblings — who are not therapists." },
  { id: "any-hour", brief: "Any hour: there when you get to it, morning or late, with nothing to keep up with." },
];

export const themeFor = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return THEMES[((y * 12 + (m - 1)) % THEMES.length + THEMES.length) % THEMES.length];
};

/** "2026-11" for a date, in India time. */
export function monthKey(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The send instant for a month: day D at H:00 India time, as UTC. */
export function sendAtFor(month: string, s: AutoSettings): Date {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(s.dayOfMonth, lastDay), s.hourIst, 0) - 330 * 60_000);
}

/** Drafts are written three days before they go, so there is time to approve them. */
export const LEAD_DAYS = 3;

export async function readAuto(supabase: SupabaseClient): Promise<AutoState> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as Partial<AutoState>;
  const s = (v.settings ?? {}) as Partial<AutoSettings>;
  return {
    settings: {
      enabled: s.enabled === true,
      dayOfMonth: Number.isInteger(s.dayOfMonth) && s.dayOfMonth! >= 1 && s.dayOfMonth! <= 28 ? s.dayOfMonth! : DEFAULT_AUTO.dayOfMonth,
      hourIst: Number.isInteger(s.hourIst) && s.hourIst! >= 8 && s.hourIst! <= 20 ? s.hourIst! : DEFAULT_AUTO.hourIst,
      listIds: Array.isArray(s.listIds) ? s.listIds.filter((x) => typeof x === "string") : [],
    },
    runs: v.runs ?? {},
  };
}

/**
 * 🔴 Save ONE month's run, re-reading everything else first. Writing back the
 * copy read at the start of a slow run (writing the newsletter takes up to two
 * minutes) undid any settings change the admin made meanwhile (review, 24 Oct).
 */
export async function saveRun(supabase: SupabaseClient, run: AutoRun): Promise<void> {
  const fresh = await readAuto(supabase);
  fresh.runs[run.month] = run;
  await writeAuto(supabase, fresh);
}

/** The month whose newsletter is next — the same rule for the settings page and the sample. */
export function nextMonth(now: Date, s: AutoState): string {
  const m = monthKey(now);
  if (sendAtFor(m, s.settings).getTime() >= now.getTime()) return m;
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/** Is this broadcast one of the monthly newsletter's drafts — and what did its checks find? */
export function autoRunOf(s: AutoState, broadcastId: string): AutoRun | null {
  return Object.values(s.runs).find((r) => r.broadcastIds.includes(broadcastId)) ?? null;
}

export async function writeAuto(supabase: SupabaseClient, s: AutoState): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert({ key: KEY, value: s, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not save the automatic broadcast: ${error.message}`);
}

export function newsletterPrompt(theme: { brief: string }): string {
  return `
Write this month's short email newsletter from Imotara to people who asked to hear from us.

THIS MONTH'S ONE THEME: ${theme.brief}
Lead with why it matters to the reader's own life, then show how Imotara answers it. One theme only — not a list of features.

${FACTS}

HOW IT MUST READ — a person writing to a person, never a campaign (spam filters and readers judge this):
- Open exactly with: Hello {{name|there}},
- Plain paragraphs, 110 to 180 words. No headings, lists, bold, images or buttons.
- At most ONE link, and only this one: ${SITE}
- Subject under 70 characters: no exclamation marks, no "free", no prices, no SHOUTING, no urgency or sales words.
- Never suggest Imotara is therapy, counselling, treatment, or a crisis service.
- End with ONE real question they could answer in a line.
- Sign off on the last line exactly: ${SIGNATURE}

Reply with nothing but JSON: {"subject": "...", "body": "..."}
`.trim();
}

/** Write the newsletter; up to three tries until the checks pass. Returns the last try with its findings. */
export async function writeNewsletter(theme: { brief: string }): Promise<{ subject: string; body: string; findings: string[] }> {
  let last = { subject: "", body: "", findings: ["not written"] };
  for (let i = 0; i < 3; i++) {
    const res = await callImotaraAI(newsletterPrompt(theme), {
      system: "You write short, plain, honest emails for a wellbeing companion app. Never a clinical claim. JSON only.",
      maxTokens: 800, temperature: 0.7, abortMs: 45_000,
    });
    if (!res.text?.trim()) throw new Error(`The writer returned nothing (${res.meta.from}).`);
    const m = parseMail(res.text);
    last = { ...m, findings: checkDraft(m.subject, m.body) };
    if (last.findings.length === 0) break;
  }
  return last;
}

export type AutoReport = { ok: boolean; reason?: string; created?: string[]; sent?: string[]; waiting?: string[] };

/**
 * One pass (hourly): create this month's drafts when it is time, send the
 * approved ones when the hour has come.
 */
export async function runAutoBroadcast(supabase: SupabaseClient, now = new Date()): Promise<AutoReport> {
  const state = await readAuto(supabase);
  if (!state.settings.enabled) return { ok: true, reason: "Automatic broadcast is off." };
  if (state.settings.listIds.length === 0) return { ok: false, reason: "No list is chosen for the automatic broadcast." };
  const report: AutoReport = { ok: true, created: [], sent: [], waiting: [] };

  // 1 · Write and create this month's drafts, LEAD_DAYS before (the lead time can cross a month end).
  for (const month of new Set([monthKey(now), monthKey(new Date(now.getTime() + LEAD_DAYS * 86_400_000))])) {
    const sendAt = sendAtFor(month, state.settings);
    const inWindow = now.getTime() >= sendAt.getTime() - LEAD_DAYS * 86_400_000 && now.getTime() < sendAt.getTime() + 7 * 86_400_000;
    if (!inWindow) continue;
    // ⛔ Claim the month first, from a FRESH read: two runs at once used to create two sets of drafts.
    const fresh = await readAuto(supabase);
    const existing = fresh.runs[month];
    if (existing && (existing.broadcastIds.length > 0 || (existing.claimedAt && now.getTime() - Date.parse(existing.claimedAt) < 15 * 60_000))) continue;
    const theme = themeFor(month);
    const claim: AutoRun = { month, theme: theme.id, sendAt: sendAt.toISOString(), broadcastIds: [], createdAt: now.toISOString(), sent: [], claimedAt: now.toISOString() };
    await saveRun(supabase, claim);

    const w = await writeNewsletter(theme);
    const from = (await availableIdentities(supabase))[0];
    if (!from) return { ok: false, reason: "No sender address is set up (Broadcast → sender identities)." };
    const ids: string[] = [];
    for (const listId of state.settings.listIds) {
      const { data, error } = await supabase.from("broadcasts").insert({
        subject: w.subject, body_html: renderHtml(w.body), body_text: renderText(w.body), body_source: w.body,
        message_type: "broadcast", list_id: listId, status: "draft",
        from_email: from.email.toLowerCase(), from_name: from.name || null, reply_to: from.email.toLowerCase(),
      }).select("id").single();
      if (error || !data) throw new Error(`Could not create the draft: ${error?.message}`);
      ids.push(data.id as string);
    }
    await saveRun(supabase, { ...claim, broadcastIds: ids, findings: w.findings, claimedAt: undefined });
    report.created!.push(...ids);
  }

  // 2 · Send what is approved, for EVERY month due in the last 30 days — a draft approved after
  //     its month ended used to be forgotten while To do still promised it would go (review, 24 Oct).
  const latest = await readAuto(supabase);
  const approvals = await readApprovals(supabase);
  for (const run of Object.values(latest.runs)) {
    const due = Date.parse(run.sendAt);
    if (!(due <= now.getTime() && now.getTime() - due < 30 * 86_400_000)) continue;
    let changed = false;
    for (const id of run.broadcastIds) {
      if (run.sent.includes(id)) continue;
      const { data: b } = await supabase.from("broadcasts")
        .select("id, status, subject, body_html, body_text, header_text, list_id, from_email, message_type").eq("id", id).maybeSingle();
      if (!b || b.status !== "draft") continue; // sent by hand, or discarded
      // ⛔ Never without approval — the approval must match the words as they are now.
      if (approvalState(approvals, id, b) !== "approved") { report.waiting!.push(id); continue; }
      await enqueueBroadcast(supabase, id, b.list_id as string);
      await supabase.from("broadcasts").update({ status: "sending", started_at: now.toISOString() }).eq("id", id).eq("status", "draft");
      run.sent.push(id);
      report.sent!.push(id);
      changed = true;
    }
    if (changed) await saveRun(supabase, run);
  }
  return report;
}
