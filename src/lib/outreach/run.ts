// src/lib/outreach/run.ts
// One pass of the outreach mailer: write any missing draft, then send what is due.
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
import { AUDIENCE_OF, MAIL, emailOf, selectMail, afterSent, type Audience, type StepId } from "@/lib/outreach/sequence";
import { draftKey, readOutreach, sendableDraft, updateOutreach } from "@/lib/outreach/store";
import { sendOutreach, senderIdentity, suppressedEmails } from "@/lib/outreach/send";
import { writeMailDraft } from "@/lib/outreach/writer";

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

const startOfUtcDay = (now: Date) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };

export async function runOutreach(supabase: SupabaseClient, now = new Date()): Promise<RunReport> {
  const report: RunReport = { ok: true, sent: [], failed: [], waitingForApproval: [], draftsWritten: [], limit: 0 };
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
  const due = selectMail(d.contacts, suppressed, now, 500);

  // 1. Write the drafts that due mail needs and that do not exist yet.
  const missing = [...new Set(due.map(({ contact, step }) => draftKey(AUDIENCE_OF[contact.tab], step)))]
    .filter((k) => !state.drafts[k])
    .slice(0, DRAFTS_PER_RUN);
  for (const k of missing) {
    const [audience, step] = k.split(":") as [Audience, StepId];
    try {
      const w = await writeMailDraft(audience, step);
      state = await updateOutreach(supabase, (s) => {
        s.drafts[k] = { ...w, status: "needs_review", writtenAt: now.toISOString(), writtenBy: "automatic" };
      });
      report.draftsWritten.push(k);
    } catch (e) {
      report.failed.push({ email: k, error: `Could not write the draft: ${(e as Error).message}` });
    }
  }

  // 2. Send what is due, within today's limit, and only with a sendable draft.
  let left = limit;
  for (const { contact, step } of due) {
    if (left <= 0) break;
    const k = draftKey(AUDIENCE_OF[contact.tab], step);
    const draft = sendableDraft(state, AUDIENCE_OF[contact.tab], step);
    if (!draft) { if (!report.waitingForApproval.includes(k)) report.waitingForApproval.push(k); continue; }
    const email = emailOf(contact);
    const out = await sendOutreach(draft, { email, name: contact.v.name, organisation: contact.v.organisation }, from);
    if (out.ok) {
      await writeRow(contact, afterSent(contact, step, now));
      report.sent.push({ email, step });
      left--;
    } else if (out.kind === "recipient") {
      await writeRow(contact, { mail_status: MAIL.failed, next_action: `Email refused: ${out.message.slice(0, 120)}` });
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
