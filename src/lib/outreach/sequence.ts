// src/lib/outreach/sequence.ts
// Who gets which outreach email, and when — read from the Call Directory sheet.
//
// 🔑 THE OWNER'S DESIGN, 24 Oct 2026 ⇒ memory decision_outreach_mail_design:
// one row in the sheet is one person for calls AND mail; only rows with a
// consent note are emailed; each person gets an introduction, a follow-up a
// week later and a last note at three weeks, and a call that ended "send me
// details" sends the info email instead.
//
// ⚠️ PURE: no network, no clock of its own — everything takes `now`, so every
// rule here is pinned by src/__tests__/outreach/whoGetsMailed.test.ts.
//
// ⛔ A SEQUENCE STOPS ON ITS OWN. Unsubscribed, bounced, complained, a call
// outcome that means "no" (not interested, do not call, wrong number), a
// meeting booked (a person takes over), or a safety flag — nothing automatic
// writes to that person again.
//
// 🔑 OWNER, 28 Oct 2026: emailed only when the admin chose "yes" for email, and
// the introduction goes at the admin's mail_date + mail_time in mail_time_zone;
// day 7 and day 21 follow at the same local time. Any hour, any day.

import { CONTACT_TABS, MAIL_INFO_DUE, STATUS, phoneOf, stoppedByAdmin, type Contact, type ContactTab } from "@/lib/voice/rules";
import { mailSlot, mailZone, yes } from "@/lib/voice/slots";

export type Audience = "individuals" | "ngos" | "education" | "eldercare" | "corporates";

/** The sheet tab decides the audience — the same five the broadcast templates are written for. */
export const AUDIENCE_OF: Record<ContactTab, Audience> = {
  Individuals: "individuals",
  NGOs: "ngos",
  Education: "education",
  Eldercare: "eldercare",
  Corporates: "corporates",
};

export const AUDIENCES: Audience[] = CONTACT_TABS.map((t) => AUDIENCE_OF[t]);

export const AUDIENCE_LABEL: Record<Audience, string> = {
  individuals: "Individuals",
  ngos: "NGOs",
  education: "Educational institutes",
  eldercare: "Eldercare",
  corporates: "Corporates",
};

export type StepId = "intro" | "followup" | "last" | "info";

/** The sequence, in order. `afterDays` counts from the introduction. */
export const SEQUENCE: { id: Exclude<StepId, "info">; afterDays: number; label: string }[] = [
  { id: "intro", afterDays: 0, label: "Introduction" },
  { id: "followup", afterDays: 7, label: "Follow-up (day 7)" },
  { id: "last", afterDays: 21, label: "Last note (day 21)" },
];

export const STEP_LABEL: Record<StepId, string> = {
  intro: "Introduction",
  followup: "Follow-up (day 7)",
  last: "Last note (day 21)",
  info: "Details they asked for on a call",
};

export const STEPS: StepId[] = ["intro", "followup", "last", "info"];

/** What the system writes in the sheet's mail_status column. */
export const MAIL = {
  infoDue: MAIL_INFO_DUE,
  inSequence: "In sequence",
  done: "Sequence finished",
  infoSent: "Info sent",
  stopped: "Stopped",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  failed: "Send failed",
} as const;

/** Call outcomes that end every automatic email to the person. */
const STOP_CALL_STATUSES: string[] = [STATUS.notInterested, STATUS.dnc, STATUS.wrongNumber, STATUS.safety, STATUS.meeting];
/** mail_status values after which nothing more is sent (Info due is the one that ASKS for a send). */
const FINAL_MAIL: string[] = [MAIL.done, MAIL.infoSent, MAIL.stopped, MAIL.unsubscribed, MAIL.bounced, MAIL.failed];

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export function emailOf(c: Contact): string {
  return (c.v.email ?? "").trim().toLowerCase();
}

/** "OK", or why this person is not emailed. Same spirit as the calling check, mail's own rules. */
/** `dnc`: the sheet's Do-not-call tab — a person who asked never to be called is not emailed either. */
export function mailCheck(c: Contact, suppressed: ReadonlySet<string>, dnc?: ReadonlySet<string>): string {
  const email = emailOf(c);
  if (!email) return "No email";
  // ⛔ Blank is not yes: nobody is emailed on a channel the admin did not choose.
  if (!yes(c.v.contact_by_email)) return "Contact by email is not yes";
  if (!EMAIL_RE.test(email)) return "Email looks wrong";
  if (!c.v.name) return "Missing name";
  if (/^sample\b/i.test(c.v.name)) return "Sample row - delete it";
  if (/open ?lm/i.test(c.v.organisation) || /openlm\.com/i.test(email + c.v.consent_note + c.v.context)) {
    return "EXCLUDED: OpenLM - never contact";
  }
  // ⛔ The owner's rule: no consent note, no email — exactly as for calls.
  if (!c.v.consent_note) return "Add consent note";
  if (stoppedByAdmin(c)) return "Stopped by admin (“Stop all contact?” is yes)";
  if (dnc?.has(phoneOf(c))) return "On do-not-call list - never contact";
  if (suppressed.has(email)) return "Unsubscribed or bounced - never email";
  if (STOP_CALL_STATUSES.includes(c.v.status)) return `Call outcome: ${c.v.status}`;
  // ⚠️ "Send failed: old@addr" — retried by itself once the admin corrects the address.
  if (c.v.mail_status.startsWith(`${MAIL.failed}:`)) {
    const failedFor = c.v.mail_status.slice(MAIL.failed.length + 1).trim().toLowerCase();
    if (failedFor === email) return `${MAIL.failed} - correct the email`;
  } else if (FINAL_MAIL.includes(c.v.mail_status)) return c.v.mail_status;
  if (!mailZone(c)) return c.v.mail_time_zone || c.v.time_zone ? "Time zone not understood" : "Add time zone";
  return "OK";
}

const DAY = 86_400_000;

/**
 * Which email this person is due now, or null.
 * ⚠️ No daytime window any more (owner, 28 Oct 2026: "anytime in 24 hours, 365
 * days … no restriction") — the admin's time IS the time.
 *   · the details email a call asked for: at once;
 *   · the introduction: once mail_date + mail_time has come — no date, no email;
 *   · day 7 / day 21: that same local time, 7 and 21 days after the admin's date.
 * ⚠️ Late is still sent (a daily limit can hold an email back a day); unlike a
 * call, an email arriving later than planned interrupts nobody.
 */
export function dueStep(c: Contact, suppressed: ReadonlySet<string>, now: Date, dnc?: ReadonlySet<string>): StepId | null {
  if (mailCheck(c, suppressed, dnc) !== "OK") return null;
  if (c.v.mail_status === MAIL.infoDue) return "info";

  const sent = Number(c.v.mail_step) || 0; // how many sequence emails have gone
  if (sent >= SEQUENCE.length) return null;
  const slot = mailSlot(c, SEQUENCE[sent].afterDays);
  if (slot.kind === "at") return now.getTime() >= slot.at.getTime() ? SEQUENCE[sent].id : null;
  if (sent === 0) return null; // no (readable) date: the introduction waits for the admin
  // A sequence begun before the schedule columns existed: the old day gaps.
  const last = Date.parse(c.v.mail_last_sent);
  if (!Number.isFinite(last)) return null; // a step was recorded without a date: a person looks
  const gapDays = SEQUENCE[sent].afterDays - SEQUENCE[sent - 1].afterDays;
  return now.getTime() - last >= gapDays * DAY ? SEQUENCE[sent].id : null;
}

/** The sheet cells to write after a step was sent. */
export function afterSent(c: Contact, step: StepId, now: Date): Partial<Record<"mail_status" | "mail_step" | "mail_last_sent", string>> {
  if (step === "info") return { mail_status: MAIL.infoSent, mail_last_sent: now.toISOString() };
  const sent = (Number(c.v.mail_step) || 0) + 1;
  return {
    mail_step: String(sent),
    mail_last_sent: now.toISOString(),
    mail_status: sent >= SEQUENCE.length ? MAIL.done : MAIL.inSequence,
  };
}

/** Who is due, oldest-in-sheet first, capped. */
export function selectMail(
  contacts: Contact[],
  suppressed: ReadonlySet<string>,
  now: Date,
  limit: number,
  dnc?: ReadonlySet<string>,
): { contact: Contact; step: StepId }[] {
  const out: { contact: Contact; step: StepId }[] = [];
  const seen = new Set<string>();
  for (const c of contacts) {
    if (out.length >= limit) break;
    const step = dueStep(c, suppressed, now, dnc);
    if (!step) continue;
    // ⛔ One email per address per run, even if the person is on two tabs.
    const email = emailOf(c);
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ contact: c, step });
  }
  return out;
}
