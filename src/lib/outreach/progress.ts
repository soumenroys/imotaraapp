// src/lib/outreach/progress.ts
// What the admin reads in the sheet: for every person, where calling and email
// stand — done, in queue, waiting, error — and what to do about a problem.
//
// 🔑 THE OWNER'S ASK (24 Oct 2026): "mark what is done, what is not done, what
// is in queue, what faced error and how the error can be resolved", in the
// sheet, so the admin never has to open the console to know.
//
// ⚠️ PURE and computed from the same rules that decide calling and mailing
// (rules.checkContact, sequence.mailCheck/dueStep), so the words in the sheet
// cannot drift from what the system actually does.

import {
  STATUS, MAX_ATTEMPTS, checkContact, missedSchedule, sheetCallDue, stoppedByAdmin, type Contact, type Directory,
} from "@/lib/voice/rules";
import { callServiceWarning, callSlot, mailSlot, showSlot, yes } from "@/lib/voice/slots";
import { MAIL, SEQUENCE, STEP_LABEL, dueStep, emailOf, mailCheck, AUDIENCE_OF } from "@/lib/outreach/sequence";
import { sendableDraft, type OutreachState } from "@/lib/outreach/store";

export type ProgressCells = { call_progress: string; mail_progress: string; what_to_do: string };

const day = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "";
};

/** How to fix each "not callable" reason, in the admin's words. */
const CALL_FIX: [RegExp, string][] = [
  [/extra 0 after/i, "Remove the 0 straight after the country code in the phone — UK 020 8863 4637 is 44 20 8863 4637."],
  [/no country code/i, "Choose the country (the code is then added for you), or start the phone with + and the country code — UK 01494 680873 is +44 1494 680873."],
  [/too many digits/i, "Check the phone number — it has more digits than any real number."],
  [/country code/i, "Type the phone and choose the country — its code is added for you."],
  [/Missing name/i, "Type the person's name."],
  [/Sample row/i, "Delete this sample row."],
  [/consent note/i, "Write how they agreed to be contacted in consent_note."],
  [/Individuals paused/i, "Individuals are called only if they asked us to call: choose yes in asked_for_call and write in consent_note when and how they asked. Everyone else waits for TRAI DLT registration."],
  [/Language not started/i, "This language is not approved for calls yet — the owner sets it to Start on the Languages tab."],
  [/No agent/i, "No calling voice exists for this language and voice — choose another voice_gender."],
  [/time zone/i, "Choose the time zone in time_zone (or call_time_zone for this call only). Countries with several zones — USA, Canada, Australia … — need one chosen."],
];

const MAIL_FIX: [RegExp, string][] = [
  [/Email looks wrong|correct the email/i, "Correct the email address — it is retried by itself once fixed."],
  [/consent note/i, "Write how they agreed to be contacted in consent_note."],
  [/time zone/i, "Choose the time zone in time_zone (or mail_time_zone for email only). Countries with several zones — USA, Canada, Australia … — need one chosen."],
  [/Missing name/i, "Type the person's name."],
];

/** How to fix a date or time the system could not read. */
const SLOT_FIX = "Type the date like 2026-11-03 and the time like 14:30 (or 2:30 PM); the time zone like Asia/Kolkata or IST.";

const fixFor = (reason: string, table: [RegExp, string][]) => table.find(([re]) => re.test(reason))?.[1] ?? "";

export function callProgress(c: Contact, d: Pick<Directory, "languages" | "dnc" | "settings">, now: Date): { text: string; fix: string } {
  const s = c.v.status || STATUS.pending;
  // 🔴 Safety first, even on a stopped row — "call them yourself today" must never be hidden (review, 24 Oct).
  if (s === STATUS.safety) return { text: "🔴 SAFETY — call them yourself today", fix: "A person must call them back today. They are never called automatically again." };
  if (stoppedByAdmin(c)) return { text: "⛔ Stopped by admin", fix: "" };
  const tries = Number(c.v.call_attempts) || 0;
  if (s === STATUS.pending && !yes(c.v.contact_by_phone)) {
    return { text: "— Not chosen for a call (contact_by_phone is not yes)", fix: c.v.call_date ? "Choose yes in contact_by_phone to call at the date you set." : "" };
  }
  switch (s) {
    case STATUS.safety: return { text: "🔴 SAFETY — call them yourself today", fix: "A person must call them back today. They are never called automatically again." };
    case STATUS.review: return { text: "⛔ Needs review — no result came back", fix: "Listen to the call in Voice calls → Call records, then decide what to do next." };
    case STATUS.dialFailed: return { text: "⛔ Error — the call could not be placed", fix: `${c.v.next_action || "Dial failed."} Check the phone number (phone), then press Retry in Voice calls → Needs a person.` };
    case STATUS.calling:
      return c.v.next_action.startsWith("Held by the call service")
        ? { text: "⏳ Held by the call service — rings in its allowed hours (their time)", fix: "" }
        : { text: "📞 On a call now", fix: "" };
    case STATUS.queued: return { text: "⏳ In queue — next free line", fix: "" };
    case STATUS.scheduled:
      return missedSchedule(c, now)
        ? { text: `⛔ Missed — was scheduled for ${day(c.v.follow_up_datetime)}`, fix: "It could not be placed at that time (calling off, or outside their hours). Schedule it again, or Clear it." }
        : { text: `⏳ Scheduled — ${day(c.v.follow_up_datetime)}`, fix: "" };
    case STATUS.noAnswer:
      return tries >= MAX_ATTEMPTS
        ? { text: `✅ Done — no answer after ${tries} tries`, fix: "" }
        : { text: `🟡 No answer (${tries} of ${MAX_ATTEMPTS}) — retried ${d.settings.autoDispatch ? "automatically" : "only if you call again"}`, fix: "" };
    case STATUS.callback: return { text: `⏳ Callback — ${day(c.v.follow_up_datetime)}`, fix: d.settings.autoDispatch ? "" : "Automatic calling is OFF — call them back yourself from Voice calls." };
    case STATUS.sendInfo: return { text: "✅ Done — asked for details (email follows)", fix: "" };
    case STATUS.interested: return { text: "✅ Done — interested", fix: "Ambassador: follow up personally." };
    case STATUS.meeting: return { text: "✅ Done — meeting booked", fix: "Ambassador: hold the meeting." };
    case STATUS.notInterested: return { text: "✅ Done — not interested (never called again)", fix: "" };
    case STATUS.dnc: return { text: "✅ Done — asked not to be called (never again)", fix: "" };
    case STATUS.wrongNumber: return { text: "⛔ Wrong number", fix: "Correct the phone, then press Retry in Voice calls → Needs a person. (Or type yes in do_not_contact.)" };
  }
  const check = checkContact(c, d);
  if (check !== "OK") return { text: `⛔ Not callable — ${check}`, fix: fixFor(check, CALL_FIX) };
  // 🔑 The admin's own time, from call_date + call_time + call_time_zone.
  const slot = callSlot(c);
  if (slot.kind === "problem") return { text: `⛔ ${slot.problem}`, fix: SLOT_FIX };
  if (slot.kind === "none") return { text: "🟡 Waiting — add a call date and time", fix: "" };
  const when = showSlot(slot.at, slot.zone);
  const due = sheetCallDue(c, now);
  if (due === "missed") return { text: `⛔ Missed — the call time ${when} passed`, fix: "Set a new call date and time (calling was off, or the line was busy too long)." };
  if (!d.settings.callingEnabled) return { text: `⏸ Call set for ${when} — calling is OFF`, fix: "Calling must be ON at that time (Voice calls → Settings)." };
  if (due === "due") return { text: "⏳ In queue — its time has come", fix: "" };
  const held = callServiceWarning(slot.at, slot.zone);
  return { text: `⏳ Call set for ${when}${held ? ` ${held}` : ""}`, fix: held ? "To ring at the time you set, choose a time between 09:00 and 21:00 their time." : "" };
}

export function mailProgress(c: Contact, suppressed: ReadonlySet<string>, state: OutreachState, now: Date, dnc?: ReadonlySet<string>): { text: string; fix: string } {
  if (!emailOf(c)) return { text: "— No email", fix: "" };
  if (!c.v.mail_status && !yes(c.v.contact_by_email)) {
    return { text: "— Not chosen for email (contact_by_email is not yes)", fix: c.v.mail_date ? "Choose yes in contact_by_email to send at the date you set." : "" };
  }
  const status = c.v.mail_status;
  const sent = Number(c.v.mail_step) || 0;
  if (status === MAIL.done) return { text: `✅ Done — all ${SEQUENCE.length} emails sent (last ${day(c.v.mail_last_sent)})`, fix: "" };
  if (status === MAIL.infoSent) return { text: `✅ Done — details sent ${day(c.v.mail_last_sent)}`, fix: "" };
  if (status === MAIL.unsubscribed) return { text: "✅ Unsubscribed — never emailed again", fix: "" };
  const check = mailCheck(c, suppressed, dnc);
  if (check !== "OK") {
    if (/do-not-call/i.test(check)) return { text: "⛔ On the do-not-call list — never emailed", fix: "" };
    if (/never email/i.test(check)) return { text: "⛔ Unsubscribed or bounced — never emailed again", fix: "" };
    if (/Call outcome/i.test(check)) return { text: `✅ Stopped — ${check.replace("Call outcome: ", "call said ")}`, fix: "" };
    if (/Stopped by admin/i.test(check)) return { text: "⛔ Stopped by admin", fix: "" };
    return { text: `⛔ Not emailed — ${check}`, fix: fixFor(check, MAIL_FIX) };
  }
  const due = dueStep(c, suppressed, now, dnc);
  const progress = sent > 0 ? `${sent} of ${SEQUENCE.length} sent (last ${day(c.v.mail_last_sent)})` : status === MAIL.infoDue ? "details email due" : "not started";
  if (!state.settings.enabled) return { text: `⏸ ${progress} — outreach email is OFF`, fix: "" };
  if (due && !sendableDraft(state, AUDIENCE_OF[c.tab], due)) {
    return { text: `⏳ ${progress} — waiting for “${STEP_LABEL[due]}” to be approved`, fix: "Approve it in Outreach mail → Emails." };
  }
  if (due) return { text: `⏳ In queue — ${STEP_LABEL[due]}`, fix: "" };
  if (sent >= SEQUENCE.length) return { text: `✅ Done — ${progress}`, fix: "" };
  // 🔑 When the next one goes — the admin's own date, then +7 and +21 days at the same local time.
  const next = mailSlot(c, SEQUENCE[sent].afterDays);
  if (next.kind === "problem") return { text: `⛔ ${next.problem}`, fix: SLOT_FIX };
  if (next.kind === "none") return sent === 0 ? { text: "🟡 Waiting — add a mail date and time", fix: "" } : { text: `🟡 ${progress} — next one on its day`, fix: "" };
  return { text: `⏳ ${STEP_LABEL[SEQUENCE[sent].id]} set for ${showSlot(next.at, next.zone)}`, fix: "" };
}

/** The three status cells for one row. */
export function progressFor(
  c: Contact, d: Pick<Directory, "languages" | "dnc" | "settings">, suppressed: ReadonlySet<string>, state: OutreachState, now: Date,
): ProgressCells {
  const call = callProgress(c, d, now);
  const mail = mailProgress(c, suppressed, state, now, d.dnc);
  const fixes = [call.fix && `Call: ${call.fix}`, mail.fix && `Email: ${mail.fix}`].filter(Boolean);
  return { call_progress: call.text, mail_progress: mail.text, what_to_do: fixes.join("  ·  ") || (call.text.startsWith("✅") && !mail.text.startsWith("⏳") ? "Nothing — done." : "Nothing needed now.") };
}
