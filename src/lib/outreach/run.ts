// src/lib/outreach/run.ts
// One pass of the outreach mailer: write any missing draft, then send what is due.
//
// 🔑 Owner, 25 Oct 2026: "add all kind of mails … everything". Every email for every
// audience is written ahead — switch ON or OFF — so the admin finds them all waiting
// for approval instead of discovering they only appear once outreach is switched on.
//
// 🔑 THE UNATTENDED PATH the owner asked for (24 Oct 2026): the admin fills the
// sheet; this runs every 10 minutes ⇒ /api/cron/outreach-mail.
//
// ⛔ EVERY LIMIT AT ONCE: the master switch, an approved draft, the person's
// daytime, the do-not-email list, our own daily cap AND the broadcast warm-up
// budget for the domain — whichever is smallest wins. Unattended mail to
// organisation inboxes bounced 30% last time; the domain's reputation is what
// keeps app mail and receipts out of spam.

import type { SupabaseClient } from "@supabase/supabase-js";
import { readDirectory, writeRow } from "@/lib/voice/sheets";
import { getBudget } from "@/lib/broadcast/warmup";
import { isResendConfigured } from "@/lib/broadcast/resendClient";
import { isUnsubscribeConfigured } from "@/lib/broadcast/unsubscribe";
import { AUDIENCES, AUDIENCE_OF, MAIL, STEPS, emailOf, selectMail, afterSent, type Audience, type StepId } from "@/lib/outreach/sequence";
import { draftKey, readOutreach, sendableDraft, updateOutreach } from "@/lib/outreach/store";
import { sendOutreach, senderIdentity, suppressedEmails } from "@/lib/outreach/send";
import { writeMailDraft } from "@/lib/outreach/writer";
import { createVersion, outreachHistory, recordSend } from "@/lib/outreach/record";

/** At most this many sends per pass, so one run stays well inside its time limit. */
export const PER_RUN = 10;
/** At most this many drafts written per pass — each is a model call. */
export const DRAFTS_PER_RUN = 2;

export type RunReport = {
  ok: boolean;
  reason?: string;
  sent: { email: string; step: StepId }[];
  failed: { email: string; error: string }[];
  waitingForApproval: string[];
  draftsWritten: string[];
  limit: number;
};

/** Every email the system can send: each step for every audience, introductions first. */
export const ALL_DRAFT_KEYS: string[] = STEPS.flatMap((st) => AUDIENCES.map((a) => draftKey(a, st)));

/**
 * Write up to `limit` drafts that do not exist yet — ahead of need, whether outreach
 * is ON or OFF. ⛔ Writing never sends: every draft lands as "needs_review" and waits
 * for approval (or for send-without-asking, which covers only these automatic ones).
 */
export async function writeMissingDrafts(supabase: SupabaseClient, now = new Date(), limit = DRAFTS_PER_RUN): Promise<{ written: string[]; failed: { email: string; error: string }[] }> {
  const out = { written: [] as string[], failed: [] as { email: string; error: string }[] };
  const state = await readOutreach(supabase);
  const missing = ALL_DRAFT_KEYS.filter((k) => !state.drafts[k]).slice(0, limit);
  for (const k of missing) {
    const [audience, step] = k.split(":") as [Audience, StepId];
    try {
      const w = await writeMailDraft(audience, step);
      // ⛔ Only if still missing: an admin may have written and approved it while this one was being written (review, 24 Oct).
      await updateOutreach(supabase, (s) => {
        if (!s.drafts[k]) s.drafts[k] = { ...w, status: "needs_review", writtenAt: now.toISOString(), writtenBy: "automatic" };
      });
      out.written.push(k);
    } catch (e) {
      out.failed.push({ email: k, error: `Could not write the draft: ${(e as Error).message}` });
    }
  }
  return out;
}

const startOfUtcDay = (now: Date) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };

export async function runOutreach(supabase: SupabaseClient, now = new Date()): Promise<RunReport> {
  const report: RunReport = { ok: true, sent: [], failed: [], waitingForApproval: [], draftsWritten: [], limit: 0 };
  // 1. Write missing drafts first — even while switched off (nothing is sent by writing).
  const drafts = await writeMissingDrafts(supabase, now);
  report.draftsWritten.push(...drafts.written);
  report.failed.push(...drafts.failed);
  let state = await readOutreach(supabase);
  if (!state.settings.enabled) return { ...report, ok: false, reason: "Outreach email is switched off." };
  if (!isResendConfigured()) return { ...report, ok: false, reason: "Email sending is not configured (RESEND_API_KEY)." };
  if (!isUnsubscribeConfigured()) return { ...report, ok: false, reason: "Unsubscribe links cannot be signed; nothing is sent without them." };
  const from = await senderIdentity(supabase);
  if (!from) return { ...report, ok: false, reason: "No sender address is set up (Broadcast → sender identities)." };

  const d = await readDirectory();
  const suppressed = await suppressedEmails(supabase);
  const today = startOfUtcDay(now);
  const sentToday = d.contacts.filter((c) => (Date.parse(c.v.mail_last_sent) || 0) >= today).length;
  const budget = await getBudget(supabase, now);
  const limit = Math.max(0, Math.min(PER_RUN, state.settings.dailyCap - sentToday, budget.remaining));
  report.limit = limit;

  // Everyone due, regardless of today's limit — to know which drafts are needed.
  const due = selectMail(d.contacts, suppressed, now, 500, d.dnc);

  // 2. Send what is due, within today's limit, and only with a sendable draft.
  const history = await outreachHistory(supabase, [...new Set(due.map(({ contact }) => emailOf(contact)))]);
  let left = limit;
  for (const { contact, step } of due) {
    if (left <= 0) break;
    const had = history.get(emailOf(contact)) ?? new Set<string>();
    const mine = draftKey(AUDIENCE_OF[contact.tab], step);
    // ⛔ Already sent (the sheet just did not hear of it) — repair the sheet, never send twice.
    if (had.has(mine)) { await writeRow(contact, afterSent(contact, step, now)).catch(() => {}); continue; }
    // ⛔ One sequence per address: the same person on two tabs used to get two (review, 24 Oct).
    if ([...had].some((k) => !k.startsWith(`${AUDIENCE_OF[contact.tab]}:`))) continue;
    const k = draftKey(AUDIENCE_OF[contact.tab], step);
    const draft = sendableDraft(state, AUDIENCE_OF[contact.tab], step);
    if (!draft) { if (!report.waitingForApproval.includes(k)) report.waitingForApproval.push(k); continue; }
    const email = emailOf(contact);
    // 🔑 Every version sent is a broadcast on the Broadcast screens ⇒ outreach/record.
    if (!draft.broadcastId) {
      const id = await createVersion(supabase, { audience: AUDIENCE_OF[contact.tab], step, subject: draft.subject, body: draft.body, from });
      state = await updateOutreach(supabase, (s) => { if (s.drafts[k]) s.drafts[k].broadcastId = id; });
      draft.broadcastId = id;
    }
    const out = await sendOutreach(draft, { email, name: contact.v.name, organisation: contact.v.organisation }, from, draft.broadcastId);
    if (out.ok) {
      // 🔑 The database record first — it is what stops a second send — then the sheet.
      await recordSend(supabase, { broadcastId: draft.broadcastId, audience: AUDIENCE_OF[contact.tab], contact, email, resendId: out.id, now });
      report.sent.push({ email, step });
      left--;
      try {
        await writeRow(contact, afterSent(contact, step, now));
      } catch (e) {
        // ⛔ The sheet could not be told: stop here rather than carry on blind; the next run repairs it from the record.
        return { ...report, ok: false, reason: `Sent to ${email}, but the sheet could not be updated: ${(e as Error).message}` };
      }
    } else if (out.kind === "recipient") {
      await writeRow(contact, { mail_status: `${MAIL.failed}: ${email}`, next_action: `Email refused: ${out.message.slice(0, 120)}` });
      report.failed.push({ email, error: out.message });
    } else if (out.kind === "fatal") {
      report.failed.push({ email, error: out.message });
      return { ...report, ok: false, reason: `Sending stopped: ${out.message}` };
    } else {
      // Transient: left as it is — the next pass tries again.
      report.failed.push({ email, error: `will retry: ${out.message}` });
    }
  }
  return report;
}
